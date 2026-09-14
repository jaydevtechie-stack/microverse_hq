const fs = require('fs');
const path = require('path');

// Folder names under src/templates/ only ever need letters/digits/-/_ —
// this also closes off path traversal (../, absolute paths) from a
// client-supplied `template` field (see routes/email.js) reaching
// path.join() unchecked.
const TEMPLATE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

// Loads a template by name from src/templates/<name>/emailTemplate.html and
// replaces {{placeholders}} with values from the `data` object. Any
// placeholder without a matching key in `data` is left as-is (rather than
// silently becoming blank) so a missing field is obvious in testing rather
// than shipping a broken-looking email.
function renderTemplate(templateName, data) {
  if (!TEMPLATE_NAME_PATTERN.test(templateName)) {
    throw new Error(`Invalid template name: ${templateName}`);
  }

  const templatePath = path.join(__dirname, '..', 'templates', templateName, 'emailTemplate.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  html = html.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : match;
  });

  return html;
}

module.exports = { renderTemplate };
