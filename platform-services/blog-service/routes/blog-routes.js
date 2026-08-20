// platform-services/blog-service/routes/blog-routes.js
//
// Mixed gating, not a blanket router-level check like audit-routes.js —
// audit-service has no public routes at all, this one does. GET /posts
// and GET /posts/:slug apply no role middleware (just read req.claims,
// which syncClaims safely leaves null with no Authorization header);
// every mutation route wraps requireAnyRealmRole individually. Same
// "one path, scoped server-side by the caller's role" posture as
// rustledger's GET /api/billing/bills.
const express = require('express');
const { requireAnyRealmRole } = require('../middleware/auth');
const posts = require('../models/posts');
const { slugify } = require('../lib/slug');
const { sanitizeBodyHtml, stripAllTags } = require('../lib/sanitize');

const router = express.Router();

function isStaff(req) {
  const roles = req.claims?.realm_access?.roles || [];
  return roles.includes('platform:marketing') || roles.includes('platform:admin');
}

// Keycloak sub is the durable id (see rustledger's created_by_id note on
// why sub over email/username); name is denormalized at create time
// since there's no local users table here to join against later.
function authorFromClaims(claims) {
  const id = claims?.sub || null;
  const name =
    claims?.name ||
    [claims?.given_name, claims?.family_name].filter(Boolean).join(' ') ||
    claims?.preferred_username ||
    null;
  return { id, name: name || null };
}

router.get('/posts', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const tag = req.query.tag || null;
  const rows = isStaff(req)
    ? await posts.listAll(limit, offset, tag)
    : await posts.listPublished(limit, offset, tag);
  res.json(rows);
});

// Registered before GET /posts/:slug — same single-segment shape, and
// Express matches by registration order, not specificity, so "popular"
// would otherwise be captured as a :slug value.
router.get('/posts/popular', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 4, 20);
  const rows = await posts.listPopular(limit);
  res.json(rows);
});

// Filter-chip row on the public blog list — most-used tags across
// published posts. Two segments (tags/popular), so this one was never
// actually ambiguous with :slug — kept above it anyway for readability.
router.get('/posts/tags/popular', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 8, 30);
  const rows = await posts.popularTags(limit);
  res.json(rows);
});

// Draft or missing both 404 identically for a non-staff caller — no leak,
// same posture as rustledger's fetch_authorized_bill.
router.get('/posts/:slug', async (req, res) => {
  const row = await posts.getBySlug(req.params.slug, isStaff(req));
  if (!row) return res.status(404).json({ message: 'Post not found' });
  // Fire-and-forget, published posts only — a staff member repeatedly
  // previewing their own draft (includeDrafts=true path) never inflates
  // a count that isn't public yet.
  if (row.published_at) posts.incrementViewCount(row.id).catch(() => {});
  res.json(row);
});

// tags: array of plain strings, same shape task-service's POST /tasks
// accepts (CreateOrderForm.js's TagInput → tags state, unjoined). No
// server-side vocabulary validation — free-form, same posture as
// task-service's own tags column; the ES suggest/create endpoints
// (search-service's /api/tags) are what keeps the *vocabulary*
// consistent, not a fixed allowlist here.
function tagsFromBody(body) {
  if (!Array.isArray(body.tags)) return [];
  return body.tags.map((t) => String(t).trim()).filter(Boolean);
}

router.post('/posts', requireAnyRealmRole('platform:marketing', 'platform:admin'), async (req, res) => {
  const title = stripAllTags(req.body.title || '');
  if (!title) return res.status(400).json({ message: 'title is required' });

  const excerpt = stripAllTags(req.body.excerpt || '');
  const bodyHtml = sanitizeBodyHtml(req.body.bodyHtml || '');
  const slug = slugify(req.body.slug || title);
  const { id: authorId, name: authorName } = authorFromClaims(req.claims);

  const row = await posts.createPost({
    title,
    slug,
    excerpt,
    bodyHtml,
    tags: tagsFromBody(req.body),
    authorId,
    authorName,
    coverImageUrl: req.body.coverImageUrl || null,
  });
  res.status(201).json(row);
});

// Full-form save, not a partial patch (see models/posts.js's updatePost
// comment) — matches BlogPostForm submitting the whole form each time.
router.patch('/posts/:id', requireAnyRealmRole('platform:marketing', 'platform:admin'), async (req, res) => {
  const existing = await posts.getById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Post not found' });

  const title = stripAllTags(req.body.title || '');
  if (!title) return res.status(400).json({ message: 'title is required' });

  const requestedSlug = slugify(req.body.slug || title);
  if (existing.published_at && requestedSlug !== existing.slug) {
    return res.status(409).json({ message: 'Slug cannot be changed once a post is published' });
  }

  const excerpt = stripAllTags(req.body.excerpt || '');
  const bodyHtml = sanitizeBodyHtml(req.body.bodyHtml || '');

  try {
    const row = await posts.updatePost(req.params.id, {
      title,
      slug: requestedSlug,
      excerpt,
      bodyHtml,
      tags: tagsFromBody(req.body),
      coverImageUrl: req.body.coverImageUrl || null,
    });
    res.json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'That slug is already taken' });
    throw err;
  }
});

router.post('/posts/:id/publish', requireAnyRealmRole('platform:marketing', 'platform:admin'), async (req, res) => {
  const existing = await posts.getById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Post not found' });
  if (existing.published_at) return res.status(409).json({ message: 'Post is already published' });

  const row = await posts.publishPost(req.params.id);
  res.json(row);
});

router.post('/posts/:id/unpublish', requireAnyRealmRole('platform:marketing', 'platform:admin'), async (req, res) => {
  const existing = await posts.getById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Post not found' });
  if (!existing.published_at) return res.status(409).json({ message: 'Post is already a draft' });

  const row = await posts.unpublishPost(req.params.id);
  res.json(row);
});

// Draft-only — see models/posts.js's deletePost comment.
router.delete('/posts/:id', requireAnyRealmRole('platform:marketing', 'platform:admin'), async (req, res) => {
  const existing = await posts.getById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Post not found' });
  if (existing.published_at) {
    return res.status(409).json({ message: 'Unpublish this post before deleting it' });
  }

  await posts.deletePost(req.params.id);
  res.status(204).end();
});

// Public — forwards to Listmonk's own public subscription API
// server-side, so the browser never talks to that container directly
// (no CORS setup needed there) and the list UUID stays out of the
// frontend bundle. LISTMONK_PUBLIC_LIST_UUID is a one-time manual step
// (create the public list in the Listmonk admin UI, paste its UUID into
// .env) — until that's done this responds 503 rather than pretending
// to succeed.
router.post('/subscribe', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'A valid email is required' });
  }

  const listUuid = process.env.LISTMONK_PUBLIC_LIST_UUID;
  if (!listUuid) {
    return res.status(503).json({ message: 'Newsletter signup is not configured yet' });
  }

  let listmonkRes;
  try {
    listmonkRes = await fetch(`${process.env.LISTMONK_URL}/api/public/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, list_uuids: [listUuid] }),
    });
  } catch {
    return res.status(502).json({ message: 'Could not reach the newsletter service' });
  }

  // Listmonk 200s a re-subscribe of an already-subscribed address too —
  // both count as success from the visitor's point of view.
  if (!listmonkRes.ok) {
    return res.status(502).json({ message: 'Could not reach the newsletter service' });
  }
  res.status(204).end();
});

module.exports = router;
