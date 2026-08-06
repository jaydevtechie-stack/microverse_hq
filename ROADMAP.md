# Microverse — roadmap

What's getting built, roughly in order. See `ARCHITECTURE.md` for the decisions behind these items.

**Status key:** ✅ Done · 🟢 Now · 🟡 Next · ⚪ Later

## Done

- ✅ GoFeeler service scaffolded and running
- ✅ `gofeeler:project-manager` / `gofeeler:analyst` / `gofeeler:reviewer` roles set up
- ✅ Orders/Tasks landing page built
- ✅ Test data created for GoFeeler
- ✅ Migrated roles to the two-dimensional model — granular `platform:*` and `service:*` roles created
- ✅ List mockup pages for tasks and customers implemented
- ✅ Branch 1 — Create Order form page/components built from mockup; master-detail split view layout with mobile fallback
- ✅ Branch 2 — dummy Order/Task data seeded; unified Order/Task detail page with role/status-based actions
- ✅ Migrated `task-service`'s `tasks.id` from `SERIAL` to `UUID` (`gen_random_uuid()` via pgcrypto), matching ARCHITECTURE.md's ID convention
- ✅ Draggable resize handle between the split view's list/detail panels (20-60% bounds); share icon group (copy link/email/native share) on the detail panel — both from `gofeeler_landing_page_split_view_resizable.html`


## Proposals

Approach + technology notes for roadmap items that need more than a one-line bullet.

### Sentiment tag input (GoFeeler)
**Approach:** Open vocabulary — tags are added on the fly, no separate dictionary-maintenance workflow. Typing a tag that doesn't fuzzy-match an existing one just adds it as a new tag in the shared vocabulary. To curb near-duplicate drift ("Frustration" vs "Frustrated" vs "Frustrating"), the fuzzy match should nudge toward an existing close tag before letting a new one get created.
**Storage:** A shared `tags` index in Elasticsearch, owned by `search-service` — not a per-service table. One document per tag (`{ name, created_at, usage_count }`). Any domain service that needs tag autocomplete queries the same index, rather than each service growing its own bespoke vocabulary.
**Tech:** Elasticsearch's built-in fuzzy matching (`fuzziness: "AUTO"` on a match query) does the typo-tolerant matching server-side — no separate client-side fuzzy library (Fuse.js) needed. Frontend is a combobox pattern (`cmdk` or `downshift`) calling search-service's tag-suggest endpoint. Selected tags render as a chip cluster, not a literal size-by-frequency word cloud. `usage_count` could later power a genuine frequency-based view (e.g. "most common tags this month") as a separate analytics feature.

**Implemented as:** `GET /tags/suggest?q=` on search-service, proxied through nginx at `/api/tags`. Fuzziness alone turned out not to be enough — edit distance between a short in-progress prefix ("urg") and the full word ("urgency") is way past what `fuzziness: AUTO` allows, so early keystrokes returned nothing. Fixed with a `bool`/`should` combining `match_bool_prefix` (catches mid-typing) and the fuzzy `match` (catches typos on an otherwise-complete word, e.g. "urgncy"). `POST /tags` does the upsert-or-bump-usage_count on pick/create, matched case-insensitively via a `name.keyword` field with a lowercase normalizer. `name.keyword` (not analyzed `name`) is deliberate for that lookup — fuzzy/prefix matching is for suggestions, not for deciding whether a submitted tag is "the same" as an existing one. Index gets seeded with the starter sentiment vocabulary (Positive/Negative/.../Escalation) on first creation only.

### MinIO architecture and permissions
**Approach:** One shared bucket across all services (not bucket-per-service — avoids re-provisioning MinIO for every new domain service). Isolation happens in the object key structure instead: `{service}/{account_id}/{order_id}/{version}/{filename}` — e.g. `gofeeler/acme-forestry/1f0a3c9e-.../v1/support-chat-export.txt`. `order_id` is a UUID (see the ID convention below), not a sequential number — the key alone encodes enough for an access check without a DB lookup, and doesn't leak enumerable order volume. `account_id` is always populated (see ARCHITECTURE.md's Account entity) — no fallback logic needed for individual customers without a company.

**Who talks to MinIO:** Only `asset-service` — the frontend never gets direct MinIO credentials.
- Upload: frontend requests a presigned PUT URL from asset-service, which checks `platform:customer` + `service:{x}` + order ownership before minting a short-lived URL. Frontend uploads directly to MinIO from there.
- Download: frontend requests a presigned GET URL; asset-service checks the requester's role **and** the task's current status. This is where "paid unlocks download" actually lives — asset-service refuses to mint a URL unless `task.status IN ('paid', 'closed')` for a customer. MinIO itself has no business-rule awareness; asset-service is the sole gatekeeper.

**Versioning:** Use MinIO's native bucket-level object versioning directly rather than reinventing version numbers — a re-upload to the same key just creates a new tracked version. (Distinct from the versioned notes/comments on a Task, which live in task-service's DB, not MinIO.)

**Orphaned uploads:** If a customer abandons the Create Order form after uploading but before submitting, the object is accepted as an orphan for now rather than building cleanup infrastructure — a conscious deferral, not an oversight. Worth revisiting via `scheduler` if it becomes a real storage cost.

**API shape:**
```
POST /assets/upload-url
  Auth: platform:customer + service:{x}, must own the target order
  Body:    { order_id, filename, content_type }
  Returns: { upload_url, object_key, expires_at }

GET /assets/{order_id}/download-url?filename=...
  Auth: role-dependent — see below
  Returns: { download_url, expires_at }

GET /assets/{order_id}
  Auth: role-dependent — list files attached to an order
  Returns: [{ filename, content_type, size, version, uploaded_at }]
```

**The two auth paths are different in kind, not just detail:**
- Upload: simple ownership check (does this customer own this order).
- Download: role **and** task status. This is the actual enforcement point for "paid unlocks download" — write it as its own explicit function (`can_download(user, order, task_status)`) rather than inline logic, since it's the one rule here encoding a real business decision. Since this needs the task's *current* status, call `task-service` synchronously on every download-URL request rather than trusting a locally cached copy kept fresh via `event-bus` — correctness matters more than shaving a network hop off a request that isn't a hot path.

**Data ownership:** stateless-first — no dedicated Postgres table for file metadata. Rely on MinIO's native `ListObjects` with a prefix for "what files exist for this order," and MinIO's custom object metadata headers for extras like `uploaded_by`. Only add a real table later if a query comes up that MinIO's prefix-listing can't answer cheaply.

**Transfer path:** asset-service only ever mints presigned URLs — actual file bytes flow directly between the frontend and MinIO, never proxied through asset-service. Upload and download requests hit asset-service; the transfer itself bypasses it entirely.

**Implemented as:** Rust/axum, matching rustledger's shape (same Cargo.toml conventions, same Dockerfile). Real deviations from the sketch above, all forced by things that only showed up once it was actually built:
- **MinIO needs its own subdomain, not a path prefix.** First attempt proxied `microverse.local/minio-storage/` to MinIO — every presigned request came back `SignatureDoesNotMatch`. The AWS SDK's SigV4 canonical-request signing doesn't account for a reverse-proxy prefix being stripped on the way through, no matter which side (signing vs. proxying) tries to compensate. Fix: `storage.microverse.local`, its own clean host with a plain root `/` proxy — same pattern as `sso.microverse.local`. Needs its own hosts-file entry and its own `DNS:` SAN on the dev cert.
- **Presigning and real MinIO API calls need different endpoints.** `S3_ENDPOINT` (the public host) works for presigning because that's a local signature computation, no network call. But `list_objects_v2`/`head_bucket`/`create_bucket` are real requests — and `storage.microverse.local` only resolves on the host machine, not inside the container. Split into two clients: `presign_client()` (public endpoint) and `internal_client()` (`S3_INTERNAL_ENDPOINT`, the Docker-network address) for anything that actually talks to MinIO.
- **`service` is an explicit field/query param everywhere**, not inferred — there's no cross-service order registry to resolve "which service does this order_id belong to," so the caller (which already knows it's dealing with, say, a gofeeler task) has to say so.
- **No order-service yet** means no real ownership check on upload (the order doesn't exist as a record anywhere until Create Order actually submits, which it still doesn't) and no `company_id` (there's no company entity anywhere in the stack, just Keycloak users) — `username` stands in for it in the object key.
- **List/download resolve the object by scanning**, not a direct key lookup — `username` sits before `order_id` in the key, and there's no way to know a customer's username from the order_id alone without order-service to ask. `ListObjectsV2` under the service prefix, filtered in memory for `/{order_id}/`. Fine at current scale; would need a real index or a reordered key to stay a cheap prefix lookup once object counts grow.
- **Auth is unverified JWT claim decoding**, not real signature verification against Keycloak's JWKS — matches task-service's current (lack of) auth posture rather than being the one service that quietly does more than its neighbors.
- nginx also got `client_max_body_size 50m` (default is 1m, far too small) and a content-type allowlist on `storage.microverse.local` (text/image/json/pdf for now — GoFeeler-shaped, broaden as other services start uploading).

### Landing page layout — master-detail split view
**Approach:** the Orders/Tasks list, Create Order form, and Order/Task detail view are one screen, not three separate page navigations. Clicking a list row or "+ New" shrinks the list to a 50% column and slides in the relevant panel (detail or create) to fill the other half — content actually grows to use the space rather than staying at a fixed narrow width inside a wider viewport. (First pass used a fixed ~260px sidebar; too cramped once real detail content — the role-specific action panels — had to fit in it.) Mockup saved as `gofeeler_landing_page` in the design system.

**Mobile fallback:** below a breakpoint, this pattern doesn't fit — the list disappears entirely instead of shrinking to a sliver, and whichever panel is active takes the full width. Stacked single-panel navigation, not a cramped split.

**Share icon group:** the detail panel header includes copy-link, email, and generic share icons (not on the Create Order panel — nothing to share until an Order exists). What "copy link" copies is a deep link to the Order/Task, gated by the same role-based access as everything else — a copied link doesn't bypass permission checks for whoever it's shared with.

**Implementation warning:** don't mix `flex: 1` (or Tailwind's `flex-1`) with JS-driven `width` toggling on the same element — `flex-basis` from the shorthand overrides `width` silently, which caused both panels to render simultaneously in the mockup. Toggle the `flex` shorthand itself (or use a single mutually-exclusive state value — `activePanel: 'list' | 'detail' | 'create'` — rather than independent boolean flags that can both end up true).

## GoFeeler

Current state: service scaffolded, `service:gofeeler` roles in place, Orders/Tasks landing page built, test data created. Create Order mockup saved to `branding/mv-1.0/design-system/mock-ups/gofeeler_create_task_form_v2.html`.

Development is branched — each branch below is a discrete unit of work, roughly in order.

**Branch 3 — Create Order form functionality**
- ✅ 3.1 Expand `asset-service` with MinIO (see Proposals — shared bucket, presigned URLs)
- ✅ 3.2 Tags/sentiments component — Elasticsearch server-side fuzzy matching via `search-service` (see Proposals; not a client-side fuzzy library)
- 🟢 3.3 Comments table for Task comments (separate table, not JSON — see SCHEMA.md's `task_comments`, versioned via new rows sharing a stable `comment_id`). One level of replies only — a reply can't itself be replied to, no arbitrary threading.
- 🟢 3.3.1 Internal comments vs. customer-facing notes — visibility column, one-level reply threading via `parent_comment_id`, customers can reply to a note (see SCHEMA.md for the full design, including the visibility-inheritance and ownership-check rules)

**Branch 4 — Task detail functionality**
- ✅ 4.0 `users` table + Keycloak sync (JIT upsert on first authenticated request, `users.id` = Keycloak `sub`, no separate local ID/mapping table) — see SCHEMA.md
- 🟢 4.0.1 Admin Users page — `platform:admin` only, no service scope needed (see ARCHITECTURE.md's role exception). List + detail via the same master-detail split view pattern (mockup: `admin_users_page_split_view`). Detail view has a deactivate/reactivate action (local `active` flag on `users`, does not touch Keycloak login — see SCHEMA.md). Permissions display resolved by storing `users.roles` as a synced array (see SCHEMA.md) rather than live-fetching from Keycloak — the earlier "nice-to-have" fetch is no longer needed.
- 🟢 4.0.2 `projects` table + expanded nav — new entity discovered while designing the Admin dropdown (see SCHEMA.md): Account → many Projects → many Orders/Tasks, each Project with one responsible user (any role). Nav finalized as: Dashboard / Reports (placeholder) / **Projects** (PM-facing, subnav: Projects, Accounts) / **Admin** (platform:admin, subnav: Users, Services) — see ARCHITECTURE.md's Dashboard/UI notes. Full page mockup with nav + subnav built (`admin_full_page_with_subnav`, since renamed conceptually — Projects/Accounts move to their own top-level "Projects" hub rather than living under Admin) — the `projects` table migration itself is still outstanding.
- 🟢 4.0.3 Build the real Project Hub and Admin pages, with roles actually applied — not just mocked up. Project Hub access (see ARCHITECTURE.md's Roles and permissions): page-level gate is `platform:project-manager` + *any* `service:*` claim; what's actually visible is filtered by two independent checks — `pm_accounts` ownership (which Accounts this PM can see) AND service scope (which task types within an owned Account they can act on). Admin requires `platform:admin` alone, per the existing no-service-scope exception.
- 🟢 4.0.4 My Profile page — accessible to *any* logged-in user regardless of role or `active` status, the one universally accessible page in the app. Paired with a "scrim" (translucent, non-interactive overlay — mockup: `inactive_user_scrim`) shown to deactivated users over everything else; the only things that stay clickable through it are My Profile and Keycloak's own account-management links (change password, edit profile). Scrim is UI only — server-side enforcement (reject non-profile API calls when `users.active = false`) is the real boundary, see ARCHITECTURE.md.
- 🟡 4.1 Assign-to-user component — word cloud + plain dropdown, kept in sync
- 🟡 4.1.1 Simple recommendation agent for assignee/reviewer suggestions — starting signal: who responds fastest to tasks (ties into the task-recommendation agent todo)

**Branch 5 — GoFeeler LLM integration**
- 🟡 Real text sentiment analysis via LLM, replacing the naive keyword matcher

**Branch 6 — search-service integration**
- ✅ search-service + Elasticsearch added to the `gofeeler` docker profile — genuinely queried now via the tag-suggest endpoint (Branch 3.2), not just scaffolded
- 🟡 Real term search — search-service exposes a permission-scoped search endpoint (owner/assignee/company filter baked into the query, per the role model), React calls it rather than touching Elasticsearch directly

**Branch 7 — Notifications & messaging**
- 🟡 PM notification bell (unread count + popup) → clicking loads the Order/Task detail page
- 🟡 Hook into `messaging` — notify the assigned analyst when new content lands in their queue

**Branch 8 — Auditing & efficiency**
- 🟡 Hook into `event-bus` — emit status-change/owner-change events (including `sentiment.analyzed`) to the Kafka scroll; audit trail is built from this stream, not a separate write path
- 🟡 Basic audit log: status transitions, owner changes, and time-in-status per Task — scoped to GoFeeler only for now (a proof of concept ahead of generalizing into the `audit` platform service)
- 🟡 Efficiency metrics from the above: GoFeeler's own processing time, and how fast analysts react to a new assignment
- ⚪ *Open question:* does GoFeeler's analysis step need its own `processing` status in the task workflow (the moment between "Analyse" clicked and results returned), or is that transient enough to just be a UI loading state with no persisted status of its own? Worth deciding before the audit log schema locks in — a real status gets logged as a state transition, a UI-only loading state doesn't.

**Branch 9 — Billing & payouts**
- 🟡 PM approval → bill creation handoff to rustledger
- 🟡 Billing button + customer payment workflow (billing-service/Stripe collection)
- ⚪ *Open question, bigger scope than originally captured:* PMs and analysts also need to get paid, not just customers billed. This is a new direction for rustledger/billing-service — collecting money (customer → Microverse) and paying it out (Microverse → analyst/PM) are different flows with different tooling (Stripe Connect for payouts is the obvious candidate, but nothing here is designed yet). Needs its own design pass before Branch 9 work starts, not just an extra bullet.

**Still not branched yet**
- ⚪ Connect to `task-service`'s shared pool properly (currently more direct)

## Security hardening (deferred, tracked)

Not blocking current feature work — see `SECURITY.md` for the full honest rundown of current posture. Listed here so these don't get forgotten once real deployment becomes a real question:

- ⚪ Real JWT signature verification against Keycloak's JWKS, replacing unverified claim decoding in `task-service` and `asset-service`
- ⚪ Secrets management — move off plaintext `.env` values before anything is shared/deployed
- ⚪ `api-gateway` as an actual dedicated piece (Kong/Traefik) rather than `nginx` doing that job informally
- ⚪ mTLS or equivalent for internal service-to-service traffic
- ⚪ Rate limiting
- ⚪ Dependency/vulnerability scanning

## Up next (not yet planned in detail)

- SpringPix — raster/GIS hotspot analysis, PostGIS integration
- PyReel — video processing
- elixtempo — time tracking
- rustledger — billing/invoices
- Djaboard — leaderboard
- RubyKudos — kudos capture
- task-service — the shared pool, `FOR UPDATE SKIP LOCKED` claiming
- workflow (Camunda) — the Order → Task → paid → closed state machine
