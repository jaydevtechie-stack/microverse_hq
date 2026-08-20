// platform-services/blog-service/lib/sanitize.js
//
// The real security boundary for this feature: this stack's JWT auth is
// stack-wide "decode, don't verify signature" (see middleware/auth.js's
// comment) — so a forged-role write is more reachable here than the
// role gate alone suggests. body_html is rendered via
// dangerouslySetInnerHTML to anonymous public visitors, so every write
// (create AND update) runs through this, not just intake.
const sanitizeHtml = require('sanitize-html');

// Same-origin only — img[src] is restricted to URLs this system itself
// minted via asset-service's blog upload route (see
// platform-services/asset-service/src/api.rs), never an arbitrary
// external URL or a data: URI (hotlink/mixed-content/stored-payload
// risk). Anything else gets the whole <img> dropped, not just the src
// attribute, so it doesn't render as a broken/misleading image.
const ASSET_PREFIX = '/api/assets/blog/';

const BODY_OPTIONS = {
  // Matches BlogEditor.js's TipTap extension set 1:1 (StarterKit doesn't
  // include Underline out of the box, so 'u' is deliberately absent here
  // too — no point allowing server-side something the editor can't
  // produce).
  allowedTags: ['p', 'br', 'strong', 'em', 's', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'code', 'pre', 'hr'],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
  exclusiveFilter: (frame) => frame.tag === 'img' && !(frame.attribs.src || '').startsWith(ASSET_PREFIX),
};

function sanitizeBodyHtml(html) {
  return sanitizeHtml(html || '', BODY_OPTIONS);
}

// title/excerpt render into <title>, meta description, and plain text
// nodes — never through dangerouslySetInnerHTML — so they're plain text,
// not run through the rich-HTML allowlist at all.
function stripAllTags(text) {
  return sanitizeHtml(text || '', { allowedTags: [], allowedAttributes: {} }).trim();
}

module.exports = { sanitizeBodyHtml, stripAllTags, ASSET_PREFIX };
