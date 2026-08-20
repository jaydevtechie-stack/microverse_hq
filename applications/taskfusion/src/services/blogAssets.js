// src/services/blogAssets.js
//
// Same presigned-PUT flow TaskFilesList.js already uses for task
// attachments (asset-service mints a short-lived upload URL, the browser
// PUTs the raw file straight to it) — just against the new blog-scoped
// route and role. The presigned upload_url itself is never stored; what
// gets kept is the separate, permanent, unauthenticated GET
// /api/assets/blog/... URL (see asset-service's blog_content handler).
import { authHeaders } from './keycloak';

export async function uploadBlogImage(postId, file) {
  const uploadRes = await fetch('/api/assets/blog/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      post_id: postId,
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
    }),
  });
  const uploadBody = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(uploadBody.message || `asset-service returned ${uploadRes.status}`);
  }

  const putRes = await fetch(uploadBody.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!putRes.ok) throw new Error('Image upload failed');

  return `/api/assets/blog/${postId}/${encodeURIComponent(file.name)}`;
}
