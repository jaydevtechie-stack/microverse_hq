// src/utils/readingTime.js
//
// Estimated from body_html client-side (strip tags, count words / 200wpm)
// — no stored field for this, it's cheap enough to derive on read and
// storing it would mean keeping it in sync on every edit.
export function estimateReadingTime(html) {
  const text = (html || '').replace(/<[^>]*>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
