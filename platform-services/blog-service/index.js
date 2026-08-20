// platform-services/blog-service/index.js
const express = require('express');
const { ensureSchema } = require('./db');
const { syncClaims } = require('./middleware/auth');
const blogRoutes = require('./routes/blog-routes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// No blanket role gate here (unlike audit-service's app.use) — this
// router has genuinely public routes (GET /posts, GET /posts/:slug),
// scoped per-request instead. See routes/blog-routes.js.
app.use('/blog', syncClaims, blogRoutes);

ensureSchema()
  .then(() => {
    console.log('Connected to Postgres, blog_posts table ready');
  })
  .catch((error) => {
    console.error('Postgres connection error:', error);
  });

const PORT = process.env.PORT || 4003;
app.listen(PORT, () => {
  console.log(`Blog service listening on port ${PORT}`);
});
