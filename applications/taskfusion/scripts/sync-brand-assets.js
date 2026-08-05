// CRA can't import outside src/ (webpack's ModuleScopePlugin blocks it),
// so there's no way to reference branding/mv-1.0 directly at import time.
// This copies the canonical files into src/assets/brand/ before every
// start/build (see package.json's pre* scripts), mirroring mv-1.0's own
// folder layout exactly so tokens.css's relative ../logos, ../images
// references resolve unmodified — no path rewriting needed.
//
// The Docker build does the equivalent with plain COPY instructions
// (see ../Dockerfile) since it can reach the branding/ directory
// directly once the build context is the repo root.

const fs = require('fs');
const path = require('path');

const BRANDING_ROOT = path.join(__dirname, '..', '..', '..', 'branding', 'mv-1.0');
const DEST_ROOT = path.join(__dirname, '..', 'src', 'assets', 'brand');

const FILES = [
  ['design-system/tokens.css', 'design-system/tokens.css'],
  ['logos/microverse-logo.png', 'logos/microverse-logo.png'],
  ['images/microverse-bg.jpg', 'images/microverse-bg.jpg'],
];

for (const [src, dest] of FILES) {
  const srcPath = path.join(BRANDING_ROOT, src);
  const destPath = path.join(DEST_ROOT, dest);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  console.log(`synced ${src}`);
}
