# blog-service

**Status:** live — self-hosted blog integration.

A `platform:marketing` (or `platform:admin`) role writes, edits, and
publishes articles through a WYSIWYG editor (`BlogEditor.js`, TipTap) in
taskfusion, backed by this service's own `blog_posts` table on the shared
`microverse-postgis` instance. Read publicly at `/blog` and `/blog/:slug`
— no CMS, no second tech stack, just this service and a new role.

## How it works

Node/Express + raw `pg`, same shape as `audit-service`: an idempotent
`ensureSchema()` on boot instead of a migrations tool. `published_at`
(`TIMESTAMPTZ`, `NULL` = draft) is the *entire* draft/publish state
machine — no separate `status` column, matching rustledger's
`bills.published_at` precedent exactly.

`GET /posts` and `GET /posts/:slug` are the one place this service departs
from `audit-service`'s "gate the whole router" shape: they carry no role
middleware at all, and instead read the caller's (optional) claims to
decide published-only vs. everything — same "one path, scoped
server-side" posture as rustledger's `GET /api/billing/bills`. Every
mutation route (`POST /posts`, `PATCH /posts/:id`,
`POST /posts/:id/publish`, `POST /posts/:id/unpublish`,
`DELETE /posts/:id`) is individually gated `platform:marketing` or
`platform:admin`.

Body HTML is sanitized server-side on every write (`lib/sanitize.js`,
`sanitize-html`) before it's ever stored — not just on intake — since it's
later rendered via `dangerouslySetInnerHTML` to anonymous public
visitors. `img[src]` is restricted to this system's own
`/api/assets/blog/...` URLs (see `platform-services/asset-service`'s new
blog routes), never an arbitrary external or `data:` URI.

Two policy defaults: a post's `slug` is only editable while it's a draft
(changing it after publish breaks shared/indexed links), and `DELETE`
only works on drafts (a published post must be unpublished first).

Tags (`tags TEXT[]`) reuse task-service's own `tags` column shape and the
same Elasticsearch-backed vocabulary/autocomplete (`GET/POST /api/tags`,
search-service) GoFeeler's Create Order form already uses — `TagInput.js`
drops into `BlogPostForm.js` unchanged. `view_count` bumps on every fetch
of a *published* post (no unique-visitor dedup anywhere in this app —
good enough for a "Popular articles" ranking, not real analytics).

## API

- `GET /posts?limit=&offset=&tag=` — published-only for anonymous/non-staff
  callers, everything (drafts included) for `platform:marketing`/
  `platform:admin`. List rows never include `body_html`.
- `GET /posts/popular?limit=` — published-only, ranked by `view_count`.
- `GET /posts/tags/popular?limit=` — most-used tags across published
  posts, powers the blog's filter-chip row.
- `GET /posts/:slug` — full row including `body_html`. Draft or missing
  both 404 identically for a non-staff caller — no leak. Increments
  `view_count` (published posts only, fire-and-forget).
- `POST /posts`, `PATCH /posts/:id` — full-form save (title, slug,
  excerpt, `tags`, `bodyHtml`, `coverImageUrl`), not a partial patch.
- `POST /posts/:id/publish`, `POST /posts/:id/unpublish`
- `DELETE /posts/:id` — drafts only, `409` otherwise.

See `docs/schema.md`'s `blog-service database` section for the full table
shape, and the asset-service section just above it for how images are
uploaded/served.
