// platform-services/blog-service/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/microverse',
});

// published_at is the only draft/publish switch (NULL = draft) — no
// separate status column, so there's nothing to drift out of sync with
// it. No FK on author_id (Keycloak sub) — same cross-service-reference-
// without-FK posture as bills.created_by_id, since there's no local
// users table to join against.
async function ensureSchema() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      excerpt TEXT,
      body_html TEXT NOT NULL,
      author_id UUID,
      author_name TEXT,
      cover_image_url TEXT,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Added after the table already existed — ALTER .. ADD COLUMN IF NOT
  // EXISTS, same idempotent-migration shape as rustledger's db.rs, since
  // this stack has no migrations tool.
  //
  // tags TEXT[] deliberately matches task-service's tasks.tags exactly
  // (native Postgres array, no join table) — reuses the same
  // Elasticsearch-backed vocabulary/autocomplete (GET/POST /api/tags,
  // search-service) and the same TagInput.js component GoFeeler's
  // Create Order form already uses, rather than inventing a separate
  // fixed-category system here.
  //
  // view_count has no unique-visitor dedup (no session/cookie tracking
  // exists anywhere in this app) — every fetch of a published post
  // increments it, a deliberate "good enough for a Popular sidebar"
  // simplification, not real analytics.
  await pool.query('ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];');
  await pool.query('ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;');
  await pool.query(
    'CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON blog_posts (published_at DESC) WHERE published_at IS NOT NULL;'
  );
  await pool.query('CREATE INDEX IF NOT EXISTS blog_posts_updated_idx ON blog_posts (updated_at DESC);');
  await pool.query(
    'CREATE INDEX IF NOT EXISTS blog_posts_popular_idx ON blog_posts (view_count DESC) WHERE published_at IS NOT NULL;'
  );
  await pool.query('CREATE INDEX IF NOT EXISTS blog_posts_tags_idx ON blog_posts USING GIN (tags);');
}

module.exports = { pool, ensureSchema };
