// platform-services/blog-service/lib/slug.js
//
// Pure slugify — collision handling (on the unique constraint) lives in
// models/posts.js, next to the INSERT that can actually hit it.
function slugify(title) {
  return String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200) || 'post';
}

module.exports = { slugify };
