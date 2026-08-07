# Roadmap — domain services

See [docs/roadmap/1.0/core.md](core.md) for the status key and [docs/architecture/1.0/domain-services.md](../../architecture/1.0/domain-services.md) for the service table this builds toward.

## GoFeeler

Current state: service scaffolded, `service:gofeeler` roles in place, Orders/Tasks landing page built, test data created. Create Order mockup saved to `branding/mv-1.0/design-system/mock-ups/gofeeler_create_task_form_v2.html`.

### Done

- ✅ GoFeeler service scaffolded and running
- ✅ `gofeeler:project-manager` / `gofeeler:analyst` / `gofeeler:reviewer` roles set up
- ✅ Orders/Tasks landing page built
- ✅ Test data created for GoFeeler
- ✅ Migrated roles to the two-dimensional model — granular `platform:*` and `service:*` roles created
- ✅ List mockup pages for tasks and customers implemented
- ✅ Branch 1 — Create Order form page/components built from mockup; master-detail split view layout with mobile fallback
- ✅ Branch 2 — dummy Order/Task data seeded; unified Order/Task detail page with role/status-based actions
- ✅ Migrated `task-service`'s `tasks.id` from `SERIAL` to `UUID` (`gen_random_uuid()` via pgcrypto), matching [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s ID convention
- ✅ Draggable resize handle between the split view's list/detail panels (20-60% bounds); share icon group (copy link/email/native share) on the detail panel — both from `gofeeler_landing_page_split_view_resizable.html`

### Proposals

Approach + technology notes for roadmap items that need more than a one-line bullet.

#### Sentiment tag input (GoFeeler)
**Approach:** Open vocabulary — tags are added on the fly, no separate dictionary-maintenance workflow. Typing a tag that doesn't fuzzy-match an existing one just adds it as a new tag in the shared vocabulary. To curb near-duplicate drift ("Frustration" vs "Frustrated" vs "Frustrating"), the fuzzy match should nudge toward an existing close tag before letting a new one get created.
**Storage:** A shared `tags` index in Elasticsearch, owned by `search-service` — not a per-service table. One document per tag (`{ name, created_at, usage_count }`). Any domain service that needs tag autocomplete queries the same index, rather than each service growing its own bespoke vocabulary.
**Tech:** Elasticsearch's built-in fuzzy matching (`fuzziness: "AUTO"` on a match query) does the typo-tolerant matching server-side — no separate client-side fuzzy library (Fuse.js) needed. Frontend is a combobox pattern (`cmdk` or `downshift`) calling search-service's tag-suggest endpoint. Selected tags render as a chip cluster, not a literal size-by-frequency word cloud. `usage_count` could later power a genuine frequency-based view (e.g. "most common tags this month") as a separate analytics feature.

**Implemented as:** `GET /tags/suggest?q=` on search-service, proxied through nginx at `/api/tags`. Fuzziness alone turned out not to be enough — edit distance between a short in-progress prefix ("urg") and the full word ("urgency") is way past what `fuzziness: AUTO` allows, so early keystrokes returned nothing. Fixed with a `bool`/`should` combining `match_bool_prefix` (catches mid-typing) and the fuzzy `match` (catches typos on an otherwise-complete word, e.g. "urgncy"). `POST /tags` does the upsert-or-bump-usage_count on pick/create, matched case-insensitively via a `name.keyword` field with a lowercase normalizer. `name.keyword` (not analyzed `name`) is deliberate for that lookup — fuzzy/prefix matching is for suggestions, not for deciding whether a submitted tag is "the same" as an existing one. Index gets seeded with the starter sentiment vocabulary (Positive/Negative/.../Escalation) on first creation only.

### Branch plan

Development is branched — each branch below is a discrete unit of work, roughly in order.

**Branch 3 — Create Order form functionality**
- ✅ 3.1 Expand `asset-service` with MinIO (see [docs/roadmap/1.0/platform-services.md](platform-services.md) — shared bucket, presigned URLs)
- ✅ 3.2 Tags/sentiments component — Elasticsearch server-side fuzzy matching via `search-service` (see Proposals above; not a client-side fuzzy library)
- ✅ 3.3 Comments table for Task comments (separate table, not JSON — see [docs/schema.md](../../schema.md)'s `task_comments`, versioned via new rows sharing a stable `comment_id`). One level of replies only — a reply can't itself be replied to, no arbitrary threading.
- ✅ 3.3.1 Internal comments vs. customer-facing notes — visibility column, one-level reply threading via `parent_comment_id`, customers can reply to a note (see [docs/schema.md](../../schema.md) for the full design, including the visibility-inheritance and ownership-check rules). Seeded data only — real submission (POST + compose UI) is deferred to Branch 4's end-to-end rework.

**Branch 4 — Task detail functionality**
- ✅ 4.0 `users` table + Keycloak sync (JIT upsert on first authenticated request, `users.id` = Keycloak `sub`, no separate local ID/mapping table) — see [docs/schema.md](../../schema.md)
- ✅ 4.0.1 Admin Users page — `platform:admin` only, no service scope needed (see [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s role exception). List + detail via the same master-detail split view pattern (mockup: `admin_users_page_split_view`). Deactivate/reactivate (local `active` flag on `users`, does not touch Keycloak login — see [docs/schema.md](../../schema.md)). Permissions display resolved by storing `users.roles` as a synced array (see [docs/schema.md](../../schema.md)) rather than live-fetching from Keycloak.
- ✅ 4.0.2 `accounts`/`pm_accounts`/`projects` tables + expanded nav — Account → many Projects → many Orders/Tasks (additive `tasks.project_id`), each Project with one responsible user (any role). Nav finalized as: Dashboard / Reports (placeholder) / **Projects** (PM-facing, subnav: Projects, Accounts) / **Admin** (platform:admin, subnav: Users, Services), avatar dropdown for My Profile/Log out — see [docs/architecture/1.0/applications.md](../../architecture/1.0/applications.md)'s Dashboard/UI notes.
- ✅ 4.0.3 Real Project Hub and Admin pages, roles actually applied — not just mocked up. Project Hub access (see [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s Roles and permissions): page-level gate is `platform:project-manager` + *any* `service:*` claim; what's actually visible is filtered by two independent checks — `pm_accounts` ownership (which Accounts this PM can see) AND service scope (which task types within an owned Account they can act on), both enforced server-side. Admin requires `platform:admin` alone. Services tab is a read-only stub — no services table exists yet.
- ✅ 4.0.4 My Profile page — accessible to *any* logged-in user regardless of role or `active` status, the one universally accessible page in the app. Paired with a "scrim" (translucent, non-interactive overlay — mockup: `services_landing_with_scrim`) shown to deactivated users over everything else; the only things that stay clickable through it are My Profile and Keycloak's own account-management links. Scrim is UI only — real enforcement is `task-service`'s `syncUser` middleware 403ing anything off a small allowlist when `users.active = false`, see [docs/security.md](../../security.md)/[docs/architecture/1.0/core.md](../../architecture/1.0/core.md).
- ✅ 4.1 Assign-to-user component — word cloud + plain dropdown, kept in sync (shared `picked` state). Candidates are real `users` holding `platform:analyst` + `service:{task.service}` (via `GET /users?platformRole=&service=`, reusing 4.0.1's roles array). Word cloud renders all candidates at equal size — no predicted-fit weighting yet, that's 4.1.1's job once it exists. Real `PATCH /api/tasks/:id` does the assignment (`unassigned → analyst`), with actual server-side validation (active + both roles required) rather than the "frontend is responsible" trust posture most of task-service still has — a bad assignment here would corrupt real status/role invariants, not just a display bug. Distinct mechanism from 4.1.2's shared-pool claim query — this is PM-picks-a-specific-analyst, not self-claim-from-queue.
- ✅ 4.1.1 **Scout** — the recommendation agent for assignee/reviewer suggestions, scouting for the best-fit talent. "Who responds fastest" can't be measured yet (no first-action/`completed_at` timestamp anywhere) — v1 signal is availability instead: no active task ranks first (fully available), otherwise ranked by how long since `assigned_at` on their oldest active task (new column, see [docs/schema.md](../../schema.md)). Documented as a starting proxy, not a real measurement — real response-time tracking is Branch 8's job. `GET /tasks/:id/recommended-analysts` returns candidates pre-ranked; word cloud sizes by rank position.
- ✅ 4.1.1.1 Analyst profile detail view — each candidate gets an info icon; clicking it shows their profile (Scout's reasoning, tasks done, active task count, idle time, current tasks list) via a single-column toggle within the panel rather than the mockup's side-by-side split (`assign_task_form_scout_and_detail`) — that panel already sits inside GofeelerSplitView's own detail pane, and a second nested split there is too cramped to use. Stats shown are all real/computed — no rating, turnaround, or efficiency (mockup shows these, but nothing tracks them: no Kudos/rating system exists, and there's no `completed_at` to compute turnaround from). Those stay explicitly unbuilt rather than fabricated, same as 4.0.1's "Permissions — coming soon" stub.
- 🟡 4.1.2 Connect to `task-service`'s shared pool properly (currently more direct) — swap in the real `FOR UPDATE SKIP LOCKED` pool-claim query from [docs/architecture/1.0/business-services.md](../../architecture/1.0/business-services.md)'s "The task pool," since this is exactly what 4.1's assign-to-user component needs to claim against correctly

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
- ⚪ *Open question, bigger scope than originally captured:* PMs and analysts also need to get paid, not just customers billed. This is a new direction for rustledger/billing-service — collecting money (customer → Microverse) and paying it out (Microverse → analyst/PM) are different flows with different tooling (Stripe Connect for payouts is the obvious candidate, but nothing here is designed yet). Needs its own design pass before Branch 9 work starts, not just an extra bullet. See [docs/business/1.0/overview.md](../../business/1.0/overview.md)'s Payouts section.

## Up next (not yet planned in detail)

- SpringPix — raster/GIS hotspot analysis, PostGIS integration
- PyReel — video processing
- elixtempo — time tracking
- rustledger — billing/invoices
- Djaboard — leaderboard
- RubyKudos — kudos capture

See [docs/roadmap/1.0/business-services.md](business-services.md) for the business-service side of the queue (task-service pool claiming, workflow state machine).
