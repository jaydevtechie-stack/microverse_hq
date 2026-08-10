import { useEffect } from 'react';

function setMetaTag(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

// Per-page <title>/meta description/robots. public/index.html ships a
// noindex default — everything except the landing page sits behind
// Keycloak auth, unreachable by a crawler anyway — so only the public
// landing page opts back into indexing (it's the one page anonymous
// visitors, including search engines, actually see).
export default function usePageMeta({ title, description, indexable = false }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) setMetaTag('description', description);
    setMetaTag('robots', indexable ? 'index, follow' : 'noindex, nofollow');
  }, [title, description, indexable]);
}
