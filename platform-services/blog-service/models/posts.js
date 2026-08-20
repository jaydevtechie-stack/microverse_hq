// platform-services/blog-service/models/posts.js
const { pool } = require('../db');

// List projections never include body_html — only GET /posts/:slug does.
// Keeps the public feed light and mirrors audit-routes.js's own
// "summary vs. detail" split.
const LIST_COLUMNS = 'id, title, slug, excerpt, tags, author_name, cover_image_url, view_count, published_at, updated_at';

async function listPublished(limit, offset, tag) {
  const { rows } = tag
    ? await pool.query(
        `SELECT ${LIST_COLUMNS} FROM blog_posts
         WHERE published_at IS NOT NULL AND tags @> ARRAY[$3::text]
         ORDER BY published_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset, tag]
      )
    : await pool.query(
        `SELECT ${LIST_COLUMNS} FROM blog_posts
         WHERE published_at IS NOT NULL
         ORDER BY published_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
  return rows;
}

// Staff view — every post, most-recently-touched first (a CMS work
// queue, not a public feed, so "updated" beats "published" as the sort
// key).
async function listAll(limit, offset, tag) {
  const { rows } = tag
    ? await pool.query(
        `SELECT ${LIST_COLUMNS} FROM blog_posts
         WHERE tags @> ARRAY[$3::text]
         ORDER BY updated_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset, tag]
      )
    : await pool.query(
        `SELECT ${LIST_COLUMNS} FROM blog_posts
         ORDER BY updated_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
  return rows;
}

// Sidebar "Popular articles" widget — no unique-visitor dedup (see
// db.js's comment on view_count), just a raw fetch-count ranking.
async function listPopular(limit) {
  const { rows } = await pool.query(
    `SELECT ${LIST_COLUMNS} FROM blog_posts
     WHERE published_at IS NOT NULL
     ORDER BY view_count DESC, published_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

// Filter-chip row — most-used tags across published posts only (a draft's
// tags shouldn't populate a public filter for content nobody can see
// yet). unnest() + GROUP BY is fine at this table's scale; revisit if
// the post count ever gets large enough to matter.
async function popularTags(limit) {
  const { rows } = await pool.query(
    `SELECT tag, COUNT(*) AS count
     FROM blog_posts, unnest(tags) AS tag
     WHERE published_at IS NOT NULL
     GROUP BY tag
     ORDER BY count DESC, tag ASC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

async function getBySlug(slug, includeDrafts) {
  const { rows } = await pool.query(
    includeDrafts
      ? 'SELECT * FROM blog_posts WHERE slug = $1'
      : 'SELECT * FROM blog_posts WHERE slug = $1 AND published_at IS NOT NULL',
    [slug]
  );
  return rows[0];
}

async function getById(id) {
  const { rows } = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [id]);
  return rows[0];
}

// Fire-and-forget from the route on every fetch of a published post —
// deliberately not awaited into the response.
async function incrementViewCount(id) {
  await pool.query('UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1', [id]);
}

// Auto-slug collisions (from slugifying a duplicate title) get a numeric
// suffix retried automatically — the caller never chose this slug
// explicitly, so silently disambiguating it is the right call. A
// manually-edited slug colliding on updatePost is a different case (see
// there) and does NOT auto-retry.
async function createPost({ title, slug, excerpt, bodyHtml, tags, authorId, authorName, coverImageUrl }) {
  let attemptSlug = slug;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO blog_posts (title, slug, excerpt, body_html, tags, author_id, author_name, cover_image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [title, attemptSlug, excerpt, bodyHtml, tags || [], authorId, authorName, coverImageUrl]
      );
      return rows[0];
    } catch (err) {
      if (err.code === '23505' && attempt < 4) {
        attemptSlug = `${slug}-${attempt + 2}`;
        continue;
      }
      throw err;
    }
  }
}

// Full-field save (matches BlogPostForm's "submit the whole form" shape,
// same as ServiceForm.js's handleSave) — not a partial PATCH, so no
// dynamic column-list building. A manual slug edit colliding here
// surfaces as a 23505 the route translates to 409, letting the author
// pick a different one rather than silently renaming what they typed.
async function updatePost(id, { title, slug, excerpt, bodyHtml, tags, coverImageUrl }) {
  const { rows } = await pool.query(
    `UPDATE blog_posts
     SET title = $1, slug = $2, excerpt = $3, body_html = $4, tags = $5, cover_image_url = $6, updated_at = now()
     WHERE id = $7
     RETURNING *`,
    [title, slug, excerpt, bodyHtml, tags || [], coverImageUrl, id]
  );
  return rows[0];
}

// Idempotency-guarded, same shape as rustledger's publish_bill — undefined
// return means "nothing to do," and the route distinguishes not-found
// from already-published by checking getById first.
async function publishPost(id) {
  const { rows } = await pool.query(
    `UPDATE blog_posts SET published_at = now(), updated_at = now()
     WHERE id = $1 AND published_at IS NULL
     RETURNING *`,
    [id]
  );
  return rows[0];
}

async function unpublishPost(id) {
  const { rows } = await pool.query(
    `UPDATE blog_posts SET published_at = NULL, updated_at = now()
     WHERE id = $1 AND published_at IS NOT NULL
     RETURNING *`,
    [id]
  );
  return rows[0];
}

// Draft-only — a published post must be unpublished first (it may have
// inbound/indexed links; no silent permanent delete of something that
// was ever live).
async function deletePost(id) {
  const { rows } = await pool.query(
    'DELETE FROM blog_posts WHERE id = $1 AND published_at IS NULL RETURNING id',
    [id]
  );
  return rows[0];
}

module.exports = {
  listPublished,
  listAll,
  listPopular,
  popularTags,
  getBySlug,
  getById,
  incrementViewCount,
  createPost,
  updatePost,
  publishPost,
  unpublishPost,
  deletePost,
};
