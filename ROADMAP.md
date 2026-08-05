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
- ✅ Branch 2 — dummy Order/Task data seeded; unified Order/Task detail page with role/status-based actions; share icon group on the detail panel


## Proposals

Approach + technology notes for roadmap items that need more than a one-line bullet.

### Sentiment tag input (GoFeeler)
**Approach:** Open vocabulary — tags are added on the fly, no separate dictionary-maintenance workflow. Typing a tag that doesn't fuzzy-match an existing one just adds it as a new tag in the shared vocabulary. To curb near-duplicate drift ("Frustration" vs "Frustrated" vs "Frustrating"), the fuzzy match should nudge toward an existing close tag before letting a new one get created.
**Storage:** A shared `tags` index in Elasticsearch, owned by `search-service` — not a per-service table. One document per tag (`{ name, created_at, usage_count }`). Any domain service that needs tag autocomplete queries the same index, rather than each service growing its own bespoke vocabulary.
**Tech:** Elasticsearch's built-in fuzzy matching (`fuzziness: "AUTO"` on a match query) does the typo-tolerant matching server-side — no separate client-side fuzzy library (Fuse.js) needed. Frontend is a combobox pattern (`cmdk` or `downshift`) calling search-service's tag-suggest endpoint. Selected tags render as a chip cluster, not a literal size-by-frequency word cloud. `usage_count` could later power a genuine frequency-based view (e.g. "most common tags this month") as a separate analytics feature.

### MinIO architecture and permissions
**Approach:** One shared bucket across all services (not bucket-per-service — avoids re-provisioning MinIO for every new domain service). Isolation happens in the object key structure instead: `{service}/{company_id}/{order_id}/{version}/{filename}` — e.g. `gofeeler/acme-forestry/1f0a3c9e-.../v1/support-chat-export.txt`. `order_id` is a UUID (see the ID convention below), not a sequential number — the key alone encodes enough for an access check without a DB lookup, and doesn't leak enumerable order volume.

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

### Landing page layout — master-detail split view
**Approach:** the Orders/Tasks list, Create Order form, and Order/Task detail view are one screen, not three separate page navigations. Clicking a list row or "+ New" shrinks the list to a fixed-width column (~260px) and slides in the relevant panel (detail or create) to fill the reclaimed width — content actually grows to use the space rather than staying at a fixed narrow width inside a wider viewport. Mockup saved as `gofeeler_landing_page` in the design system.

**Mobile fallback:** below a breakpoint, this pattern doesn't fit — the list disappears entirely instead of shrinking to a sliver, and whichever panel is active takes the full width. Stacked single-panel navigation, not a cramped split.

**Share icon group:** the detail panel header includes copy-link, email, and generic share icons (not on the Create Order panel — nothing to share until an Order exists). What "copy link" copies is a deep link to the Order/Task, gated by the same role-based access as everything else — a copied link doesn't bypass permission checks for whoever it's shared with.

**Implementation warning:** don't mix `flex: 1` (or Tailwind's `flex-1`) with JS-driven `width` toggling on the same element — `flex-basis` from the shorthand overrides `width` silently, which caused both panels to render simultaneously in the mockup. Toggle the `flex` shorthand itself (or use a single mutually-exclusive state value — `activePanel: 'list' | 'detail' | 'create'` — rather than independent boolean flags that can both end up true).

## GoFeeler

Current state: service scaffolded, `service:gofeeler` roles in place, Orders/Tasks landing page built, test data created. Create Order mockup saved to `branding/mv-1.0/design-system/mock-ups/gofeeler_create_task_form_v2.html`.

Development is branched — each branch below is a discrete unit of work, roughly in order.

**Branch 3 — Create Order form functionality**
- 🟢 3.1 Expand `asset-service` with MinIO (see Proposals — shared bucket, presigned URLs)
- 🟢 3.2 Tags/sentiments component — Elasticsearch server-side fuzzy matching via `search-service` (see Proposals; not a client-side fuzzy library)
- 🟢 3.3 Comments table for Task comments (separate table, not JSON — see Proposals in a future update for schema)

**Branch 4 — Task detail functionality**
- 🟡 4.1 Assign-to-user component — word cloud + plain dropdown, kept in sync
- 🟡 4.1.1 Simple recommendation agent for assignee/reviewer suggestions — starting signal: who responds fastest to tasks (ties into the task-recommendation agent todo)

**Branch 5 — GoFeeler LLM integration**
- 🟡 Real text sentiment analysis via LLM, replacing the naive keyword matcher

**Branch 6 — search-service integration**
- 🟢 search-service + Elasticsearch added to the `gofeeler` docker profile (scaffolded, not yet queried)
- 🟡 Real term search — search-service exposes a permission-scoped search endpoint (owner/assignee/company filter baked into the query, per the role model), React calls it rather than touching Elasticsearch directly

**Still not branched yet**
- 🟡 PM notification bell (unread count + popup) → clicking loads the Order/Task detail page
- 🟡 PM approval → bill creation handoff to rustledger
- 🟡 Hook into `event-bus` — emit a `sentiment.analyzed` event to the Kafka scroll per analysis
- 🟡 Hook into `messaging` — notify the assigned analyst when new content lands in their queue
- ⚪ Connect to `task-service`'s shared pool properly (currently more direct)
- ⚪ Customer payment flow (deferred — depends on billing-service + rustledger)

## Up next (not yet planned in detail)

- SpringPix — raster/GIS hotspot analysis, PostGIS integration
- PyReel — video processing
- elixtempo — time tracking
- rustledger — billing/invoices
- Djaboard — leaderboard
- RubyKudos — kudos capture
- task-service — the shared pool, `FOR UPDATE SKIP LOCKED` claiming
- workflow (Camunda) — the Order → Task → paid → closed state machine
