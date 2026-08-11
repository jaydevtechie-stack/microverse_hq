// CRA can't import outside src/ (webpack's ModuleScopePlugin blocks it),
// so there's no way to reference branding/mv-1.0 directly at import time.
// This copies the canonical files into src/assets/brand/ before every
// start/build (see package.json's pre* scripts), mirroring mv-1.0's own
// folder layout exactly so tokens.css's relative ./logos, ./images
// references resolve unmodified — no path rewriting needed.
//
// The Docker build does the equivalent (see ../Dockerfile) — same theme
// selection logic, just in shell (sed/case) instead of Node.

const fs = require('fs');
const path = require('path');

const BRANDING_ROOT = path.join(__dirname, '..', '..', '..', 'branding', 'mv-1.0');
const DEST_ROOT = path.join(__dirname, '..', 'src', 'assets', 'brand');

const THEME = process.env.REACT_APP_BRAND_THEME || 'default';

const FILES = [
  ['design-system/tokens.css', 'design-system/tokens.css'],
  ['design-system/logos/microverse-logo.png', 'design-system/logos/microverse-logo.png'],
  ['design-system/images/microverse-bg.jpg', 'design-system/images/microverse-bg.jpg'],
];

for (const [src, dest] of FILES) {
  const srcPath = path.join(BRANDING_ROOT, src);
  const destPath = path.join(DEST_ROOT, dest);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  console.log(`synced ${src}`);
}

// The app only ever sees ONE theme, at a fixed, theme-agnostic path — it
// has no idea Vienna or Uhuru exist. [data-brand-theme="<id>"] exists so
// the *source* catalog can hold all three themes at once; a build that
// only ever ships one theme doesn't need it, so it's rewritten to bare
// :root here — meaning the app never has to set data-brand-theme on
// anything either.
const THEME_DIR = path.join(BRANDING_ROOT, 'design-system/themes', THEME);
const THEME_DEST = path.join(DEST_ROOT, 'design-system/theme');
fs.mkdirSync(THEME_DEST, { recursive: true });
const gate = new RegExp(`\\[data-brand-theme="${THEME}"\\]`, 'g');
for (const mode of ['light', 'dark']) {
  const css = fs.readFileSync(path.join(THEME_DIR, 'css', `${mode}.css`), 'utf8');
  fs.writeFileSync(path.join(THEME_DEST, `${mode}.css`), css.replace(gate, ':root'));
  console.log(`synced design-system/themes/${THEME}/css/${mode}.css -> design-system/theme/${mode}.css`);
}

// If (and only if) the selected theme has its own images/ folder,
// overwrite the canonical images/microverse-bg.jpg copied above with
// whatever single file is in there — Default has no images/ folder, so
// it silently keeps the canonical image, no special-casing needed.
const themeImagesDir = path.join(THEME_DIR, 'images');
if (fs.existsSync(themeImagesDir)) {
  const image = fs.readdirSync(themeImagesDir).find((name) => !name.startsWith('.'));
  if (image) {
    fs.copyFileSync(path.join(themeImagesDir, image), path.join(DEST_ROOT, 'design-system/images/microverse-bg.jpg'));
    console.log(`synced design-system/themes/${THEME}/images/${image} -> design-system/images/microverse-bg.jpg`);
  }
}
