const fs = require('fs');
const path = require('path');

// Loads a template by name from src/templates/<name>/emailTemplate.html and
// replaces {{placeholders}} with values from the `data` object. Any
// placeholder without a matching key in `data` is left as-is (rather than
// silently becoming blank) so a missing field is obvious in testing rather
// than shipping a broken-looking email.
function renderTemplate(templateName, data) {
  const templatePath = path.join(__dirname, '..', 'templates', templateName, 'emailTemplate.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  html = html.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : match;
  });

  return html;
}

module.exports = { renderTemplate };
