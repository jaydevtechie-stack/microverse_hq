const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { slugify } = require('./slug');

describe('slugify', () => {
  test('lowercases and hyphenates a normal title', () => {
    assert.equal(slugify('Hello World'), 'hello-world');
  });

  test('collapses runs of non-alphanumeric characters into one hyphen', () => {
    assert.equal(slugify('Hello, World!! How are you?'), 'hello-world-how-are-you');
  });

  test('trims leading and trailing hyphens', () => {
    assert.equal(slugify('  --Leading and trailing--  '), 'leading-and-trailing');
  });

  test('numbers are kept as-is', () => {
    assert.equal(slugify('Top 10 Tips in 2026'), 'top-10-tips-in-2026');
  });

  test('an empty or fully-punctuation title falls back to "post"', () => {
    assert.equal(slugify(''), 'post');
    assert.equal(slugify('!!!'), 'post');
  });

  test('truncates to 200 characters', () => {
    const longTitle = 'a'.repeat(300);
    const result = slugify(longTitle);
    assert.equal(result.length, 200);
  });

  test('coerces a non-string input via String()', () => {
    assert.equal(slugify(2026), '2026');
  });
});
