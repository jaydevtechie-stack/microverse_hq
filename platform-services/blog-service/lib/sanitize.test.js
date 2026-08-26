const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeBodyHtml, stripAllTags, ASSET_PREFIX } = require('./sanitize');

describe('sanitizeBodyHtml', () => {
  test('keeps allowed tags from the TipTap StarterKit set', () => {
    const html = '<p>Hello <strong>world</strong>, <em>this</em> is <s>great</s>.</p>';
    assert.equal(sanitizeBodyHtml(html), html);
  });

  test('strips a script tag entirely (XSS)', () => {
    const html = '<p>hi</p><script>alert(1)</script>';
    assert.equal(sanitizeBodyHtml(html), '<p>hi</p>');
  });

  test('strips an inline event handler attribute', () => {
    const html = '<p onclick="alert(1)">hi</p>';
    assert.ok(!sanitizeBodyHtml(html).includes('onclick'));
  });

  test('keeps an img whose src is under the asset-service prefix', () => {
    const html = `<img src="${ASSET_PREFIX}post-1/cover.png" alt="cover">`;
    const result = sanitizeBodyHtml(html);
    assert.ok(result.includes(`${ASSET_PREFIX}post-1/cover.png`));
  });

  test('drops an img pointing at an external URL entirely, not just its src', () => {
    const html = '<p>before</p><img src="https://evil.example/x.png" alt="x"><p>after</p>';
    const result = sanitizeBodyHtml(html);
    assert.ok(!result.includes('<img'));
    assert.ok(result.includes('before') && result.includes('after'));
  });

  test('drops an img with a data: URI src', () => {
    const html = '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" alt="x">';
    assert.ok(!sanitizeBodyHtml(html).includes('<img'));
  });

  test('adds rel="noopener noreferrer" to links', () => {
    const html = '<a href="https://example.com">link</a>';
    assert.ok(sanitizeBodyHtml(html).includes('rel="noopener noreferrer"'));
  });

  test('a javascript: URI link is stripped down to a bare anchor with no href', () => {
    const html = '<a href="javascript:alert(1)">click</a>';
    assert.ok(!sanitizeBodyHtml(html).includes('javascript:'));
  });

  test('null/undefined input becomes an empty string, not a throw', () => {
    assert.equal(sanitizeBodyHtml(null), '');
    assert.equal(sanitizeBodyHtml(undefined), '');
  });
});

describe('stripAllTags', () => {
  test('removes all markup, keeping only the text', () => {
    assert.equal(stripAllTags('<p>Hello <strong>world</strong></p>'), 'Hello world');
  });

  test('strips a script tag and its contents entirely', () => {
    assert.equal(stripAllTags('Title<script>alert(1)</script>'), 'Title');
  });

  test('trims surrounding whitespace', () => {
    assert.equal(stripAllTags('  plain text  '), 'plain text');
  });

  test('null/undefined input becomes an empty string', () => {
    assert.equal(stripAllTags(null), '');
    assert.equal(stripAllTags(undefined), '');
  });
});
