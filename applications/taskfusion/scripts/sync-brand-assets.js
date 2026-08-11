// CRA can't import outside src/ (webpack's ModuleScopePlugin blocks it),
// so there's no way to reference branding/mv-1.0 directly at import time.
// This copies the canonical files into src/assets/brand/ before every
// start/build (see package.json's pre* scripts), mirroring mv-1.0's own
// folder layout exactly so tokens.css's relative ./logos, ./images
// references resolve unmodified — no path rewriting needed.
//
// The Docker build does the equivalent with plain COPY instructions
// (see ../Dockerfile) since it can reach the branding/ directory
// directly once the build context is the repo root.

const fs = require('fs');
const path = require('path');

const BRANDING_ROOT = path.join(__dirname, '..', '..', '..', 'branding', 'mv-1.0');
const DEST_ROOT = path.join(__dirname, '..', 'src', 'assets', 'brand');

// Read the theme catalog rather than hardcoding filenames here — each
// theme's backgroundImage is a real filename (e.g.
// vienna-grossglockner-bg.jpg), not a fixed "bg.jpg" every theme shares.
const themeConfig = JSON.parse(
  fs.readFileSync(path.join(BRANDING_ROOT, 'design-system/themes/theme.config.json'), 'utf8')
);

const FILES = [
  ['design-system/tokens.css', 'design-system/tokens.css'],
  ['design-system/logos/microverse-logo.png', 'design-system/logos/microverse-logo.png'],
  ['design-system/images/microverse-bg.jpg', 'design-system/images/microverse-bg.jpg'],
  ...themeConfig.themes.flatMap(({ dir, css, backgroundImage }) => [
    [`design-system/themes/${dir}/${css.light}`, `design-system/themes/${dir}/${css.light}`],
    [`design-system/themes/${dir}/${css.dark}`, `design-system/themes/${dir}/${css.dark}`],
    // Not every theme has its own background image (Default doesn't —
    // it inherits tokens.css's), so skip themes without one entirely
    // rather than generating a broken path.
    ...(backgroundImage
      ? [[`design-system/themes/${dir}/${backgroundImage}`, `design-system/themes/${dir}/${backgroundImage}`, { optional: true }]]
      : []),
  ]),
];

for (const [src, dest, opts = {}] of FILES) {
  const srcPath = path.join(BRANDING_ROOT, src);
  const destPath = path.join(DEST_ROOT, dest);
  if (opts.optional && !fs.existsSync(srcPath)) {
    console.log(`skipped ${src} (not provided yet)`);
    continue;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  console.log(`synced ${src}`);
}
