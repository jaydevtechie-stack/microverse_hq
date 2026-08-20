// platform-services/blog-service/index.js
const express = require('express');
const { ensureSchema } = require('./db');
const { syncClaims } = require('./middleware/auth');
const blogRoutes = require('./routes/blog-routes');
const posts = require('./models/posts');
const { publishPostEvent } = require('./events/kafka-producer');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// No blanket role gate here (unlike audit-service's app.use) — this
// router has genuinely public routes (GET /posts, GET /posts/:slug),
// scoped per-request instead. See routes/blog-routes.js.
app.use('/blog', syncClaims, blogRoutes);

// Reconciles search-service's blog-articles index with whatever's
// already published in Postgres on every boot — not just a one-time
// migration, since it's a cheap, idempotent republish (search-service
// upserts by post_id) rather than a destructive backfill. Needed
// because the Kafka producer only fires on create/update/publish/
// unpublish going forward; without this, any post published before
// events/kafka-producer.js existed (or before the ES index was rebuilt)
// would stay permanently invisible to anonymous search until someone
// happened to edit or republish it by hand.
async function reindexPublishedPosts() {
  const published = await posts.listPublishedForIndex();
  await Promise.all(published.map((post) => publishPostEvent('post.reindexed', post)));
  console.log(`Re-published ${published.length} post(s) for search indexing`);
}

ensureSchema()
  .then(() => {
    console.log('Connected to Postgres, blog_posts table ready');
    // Best-effort, same posture as every publishPostEvent call — a
    // reindex hiccup (e.g. Kafka not reachable yet at cold boot) must
    // not stop the HTTP server from coming up.
    reindexPublishedPosts().catch((error) => {
      console.error('Search-index backfill failed:', error.message);
    });
  })
  .catch((error) => {
    console.error('Postgres connection error:', error);
  });

const PORT = process.env.PORT || 4003;
app.listen(PORT, () => {
  console.log(`Blog service listening on port ${PORT}`);
});
