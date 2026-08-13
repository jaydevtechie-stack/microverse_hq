// business-services/task-service/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/microverse',
});

// Status mirrors ARCHITECTURE.md's task workflow:
// unassigned -> analyst -> reviewer -> done -> paid -> closed (with
// reviewer -> analyst on rejection). `service` ties a task to the
// domain service (and matching Keycloak role) it belongs to, e.g.
// 'gofeeler' — that's the filter a PM's role list gets checked against.
async function ensureSchema() {
  // gen_random_uuid() needs pgcrypto — not built into core until PG13,
  // and even then this stays explicit rather than assuming the image
  // has it. Random (v4), not time-ordered (v7): ARCHITECTURE.md's ID
  // convention prefers v7 to avoid B-tree fragmentation on inserts,
  // but there's no built-in v7 generator in plain Postgres yet, and
  // pgcrypto's gen_random_uuid() is the documented fallback.
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unassigned',
      assignee TEXT,
      owner TEXT,
      due_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Separate table, not JSON on tasks — every edit is a new row sharing
  // the same comment_id (never an UPDATE), which is what makes this an
  // audit trail rather than just mutable text. parent_comment_id is
  // NULL for a top-level comment; when set, it points at another row's
  // comment_id (a thread, not a specific version) and marks this as a
  // reply. One level only — see SCHEMA.md's task_comments for why that
  // can't be a CHECK constraint and is enforced application-side.
  //
  // visibility splits internal staff discussion ('internal') from
  // customer-facing notes the customer can see and reply to
  // ('customer') — one table, not two, since the shape is identical
  // and only who can see it differs. Visibility inheritance (a reply
  // matches its parent's visibility) and the customer ownership check
  // are both application-side too, same reasoning as one-level replies.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      comment_id UUID NOT NULL,
      parent_comment_id UUID,
      task_id UUID NOT NULL REFERENCES tasks(id),
      author TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'customer')),
      version INT NOT NULL DEFAULT 1,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Idempotent fallback for a task_comments table that already existed
  // without visibility (e.g. mid-session dev environments) — matches
  // the ALTER TABLE ... ADD COLUMN IF NOT EXISTS pattern used elsewhere.
  await pool.query(`
    ALTER TABLE task_comments
      ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal';
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments (task_id, created_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_task_comments_thread ON task_comments (comment_id, version);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_task_comments_parent ON task_comments (parent_comment_id);');

  // id is the Keycloak `sub` claim directly — no separate local ID, no
  // mapping table between the two (see SCHEMA.md's users). Populated
  // via JIT upsert (models/user.js's upsertFromClaims) the first time
  // task-service sees a given user's JWT, not a login webhook.
  //
  // active is task-service's own bookkeeping (task-assignment
  // eligibility) — deactivating here never touches Keycloak login, see
  // SCHEMA.md. roles is synced from the JWT's realm_access.roles on
  // every JIT upsert, purely for display (Admin Users page's role
  // chips) — it is never consulted for an actual access-control
  // decision, which always reads the live JWT instead.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      roles TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Idempotent fallback for a users table that already existed without
  // these columns (mid-session dev environments).
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT '{}';
  `);

  // Company or individual. There is deliberately no separate
  // `customers` table — a Customer is just a `users` row, same identity
  // path as every other role. `account_id` (see the ALTER below and
  // models/user.js's ensureAccountForCustomer) is a single "default"
  // Account — set once, on a brand-new customer's first order, and
  // never touched again by that auto-provisioning path. It's not the
  // only Account a customer can belong to: `user_accounts` below covers
  // the case a company-side contact needs (one person acting as the
  // customer on more than one Account, e.g. an agency contact spanning
  // several client accounts) — `account_id` alone can't express that.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL CHECK (type IN ('company', 'individual')),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Many-to-many on purpose — doesn't force "one PM per account vs a
  // pool" either way. This is the ownership half of the Project Hub's
  // two-independent-checks access rule (see ARCHITECTURE.md's Roles
  // and permissions): which Accounts a PM can see at all, separate
  // from which task *types* (service scope) they can act on once
  // inside one they own.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pm_accounts (
      pm_id UUID NOT NULL REFERENCES users(id),
      account_id UUID NOT NULL REFERENCES accounts(id),
      PRIMARY KEY (pm_id, account_id)
    );
  `);

  // Additional Account memberships for a customer, beyond their single
  // `account_id` default — same "many-to-many, doesn't force one shape"
  // reasoning as pm_accounts above, added once a real scenario (one
  // customer contact needing to place/see orders across more than one
  // Account) showed `account_id` alone wasn't enough. `account_id`
  // stays the account a bare "create order" attaches to when nothing
  // else is specified; this table is the *other* Accounts that
  // customer is also recognized on.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_accounts (
      user_id UUID NOT NULL REFERENCES users(id),
      account_id UUID NOT NULL REFERENCES accounts(id),
      PRIMARY KEY (user_id, account_id)
    );
  `);

  // Sits between Account and Order/Task — an Account has many Projects,
  // each with one responsible user (any role, not locked to PM) and
  // grouping many Orders/Tasks. Also the contract unit (see
  // BUSINESS.md) — payment_terms lives here rather than a separate
  // contracts table.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id),
      name TEXT NOT NULL,
      responsible_user_id UUID REFERENCES users(id),
      payment_terms TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Additive, nullable — the Project Hub's Project detail view needs
  // to show real linked Tasks (see the platform_projects_hub_and_admin
  // mockup), but this is deliberately just this one column, not the
  // fuller customer_id/account_id/assignee_id/owner_id/status_id
  // migration SCHEMA.md's "tasks (target shape)" describes — that
  // stays future work, same "current vs. target schema" gap already
  // documented there for the rest of the table.
  await pool.query(`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
  `);

  // Set when 4.1's PATCH /tasks/:id assigns an analyst — the minimal
  // timestamp Scout's v1 availability signal needs (4.1.1). Not a
  // real response-time measurement (that needs a first-action or
  // completed-at timestamp neither of which exist) — see
  // models/scout.js for the honest explanation of what this proxies.
  await pool.query(`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
  `);

  // A customer is a users row (see the accounts comment above) —
  // account_id is set on their first order, not at sync time; NULL
  // means "hasn't ordered yet, no Account exists for them." See
  // models/user.js's ensureAccountForCustomer.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);
  `);

  // customer_id: who originally submitted the order, fixed for its
  // lifetime — distinct from assignee/owner, which are workflow-state
  // TEXT that changes as the task moves (see ARCHITECTURE.md's
  // assignee/owner table). account_id is a denormalized copy of the
  // customer's users.account_id at creation time, feeding the MinIO
  // key's account segment. context/tags are the order's free-text
  // description and sentiment tags, entered on the Create Order form.
  await pool.query(`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id);
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS context TEXT;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[];
  `);
  // When the task reached a terminal status (done/paid/closed). Column
  // only — nothing sets it yet, same "stub now, build later" posture as
  // 4.0.3's Services tab: the real status-transition endpoints (submit
  // for review, approve, bill) are Branch 6-9 work that doesn't exist
  // in task-service yet, so there's no real event to stamp this from.
  // Exists now so the schema/API/UI don't need another round-trip once
  // those transitions land — they'll just start setting it.
  await pool.query(`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN (tags);');

  // A customer-created project starts 'dormant' — not visible/actionable
  // as a real engagement until an account-manager approves it — and
  // moves to 'active' from there. No DB-level CHECK (same as
  // tasks.status — free-text column, enforced at the application layer,
  // see SCHEMA.md's "current vs. target schema" note on why). Backfills
  // existing rows to 'active' via the column DEFAULT — every project
  // that existed before this column did was already a real, operating
  // engagement, not something newly pending approval.
  await pool.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
  `);

  // Backs the Dashboard's service grid and Admin's Services tab (see
  // ARCHITECTURE.md's Dashboard/UI notes) — replaces the hardcoded
  // SERVICES array that lived in the frontend's data/services.js.
  // Icon/illustration/color theme and subdomain/required_role stay
  // frontend-only static config (code assets and deployment concerns,
  // not admin-editable content) — this table owns only the fields an
  // admin actually edits via the add/edit form.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      tech TEXT,
      title TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('online', 'basic', 'building', 'designing', 'planned')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // One-time seed of the 7 known services — ON CONFLICT DO NOTHING so
  // this is safe to run on every boot without clobbering admin edits.
  // Copy pulled from ROADMAP.md's "Up next" one-liners (title) and the
  // service_in_progress_landing mockup's own blurb text (description),
  // not invented.
  await pool.query(`
    INSERT INTO services (key, name, tech, title, description, status) VALUES
      ('gofeeler', 'Gofeeler', 'Go', 'AI-powered sentiment analysis', 'Understands customer feedback and surfaces sentiment, tags, and recommendations for PMs, analysts, and reviewers.', 'online'),
      ('springpix', 'SpringPix', 'Java', 'Raster & GIS hotspot analysis', 'The basic engine is live. Advanced GIS analysis is still being built.', 'basic'),
      ('pyreel', 'PyReel', 'Python', 'Video processing pipeline', 'The basic engine is live. Advanced video processing features are still being built.', 'basic'),
      ('djaboard', 'Djaboard', 'Python', 'Leaderboards & gamification', 'This service is actively under construction.', 'building'),
      ('elixtempo', 'elixtempo', 'Elixir', 'Time tracking', 'Architecture and data model are still being designed.', 'designing'),
      ('rustledger', 'rustledger', 'Rust', 'Billing & invoices', 'Architecture and data model are still being designed.', 'designing'),
      ('rubykudos', 'RubyKudos', 'Ruby', 'Kudos capture', 'Planned for a future phase; work has not started yet.', 'planned')
    ON CONFLICT (key) DO NOTHING;
  `);

  // Which account-manager owns this Account (6.2.5) — supersedes 4.3's
  // "no table at all, AM is unscoped by design" resolution, reversed
  // once a privacy-sensitive AM-gated action (6.3's no_index toggle)
  // needed real ownership scoping rather than platform-wide access.
  // Nullable: an account created before this column existed (or in an
  // environment with no platform:account-manager user yet) is simply
  // unowned, not an error — the backfill below only ever assigns an
  // owner, never blocks on one being available.
  await pool.query(`
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_manager_id UUID REFERENCES users(id);
  `);
  // One-time, idempotent backfill — every pre-existing unowned account
  // gets assigned to whichever active user currently holds
  // platform:account-manager. Picks one deterministically (oldest synced
  // user) rather than splitting accounts across multiple AMs with no
  // real basis for the split; re-running this is a no-op once accounts
  // are owned, and a no-op entirely in an environment with no AM user
  // yet (nothing to assign).
  await pool.query(`
    UPDATE accounts SET account_manager_id = (
      SELECT id FROM users
      WHERE active = true AND roles @> ARRAY['platform:account-manager']
      ORDER BY created_at ASC
      LIMIT 1
    )
    WHERE account_manager_id IS NULL
      AND EXISTS (
        SELECT 1 FROM users
        WHERE active = true AND roles @> ARRAY['platform:account-manager']
      );
  `);

  // Excluded from search (6.3) — set, this triggers removal of the
  // task's already-indexed ES doc, not just suppression of future
  // writes (tasks are default-index-with-exclusions). See
  // events/kafka-producer.js's taskToEvent and search-service's
  // kafka_consumer.py for the removal mechanism itself.
  await pool.query(`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS no_index BOOLEAN NOT NULL DEFAULT false;
  `);
}

module.exports = { pool, ensureSchema };
