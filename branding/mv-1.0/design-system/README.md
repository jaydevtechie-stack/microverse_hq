# Microverse Design System (mv-1.0)

Single source of truth for color, type, spacing, radius and shadow across
every Microverse surface — the React/Vue/Svelte dashboards and the Keycloak
theme. Canonical file: [`tokens.css`](./tokens.css), plain CSS custom
properties with no build step, so it can be linked directly from a Keycloak
`.ftl` theme as well as imported into any frontend framework.

## Palette

Extracted from the mv-1.0 brand's Bootswatch builds (Flatly = light,
Darkly = dark), kept as reference/compiled bundles at
`../themes/{light,dark}/bootstrap.min.css`.

| Token                  | Light     | Dark      |
| ----------------------- | --------- | --------- |
| `--mv-color-primary`    | `#2c3e50` | `#375a7f` |
| `--mv-color-secondary`  | `#95a5a6` | `#444444` |
| `--mv-color-success`    | `#18bc9c` | `#00bc8c` |
| `--mv-color-info`       | `#3498db` | `#3498db` |
| `--mv-color-warning`    | `#f39c12` | `#f39c12` |
| `--mv-color-danger`     | `#e74c3c` | `#e74c3c` |
| `--mv-color-light`      | `#ecf0f1` | `#adb5bd` |
| `--mv-color-dark`       | `#7b8a8b` | `#303030` |
| `--mv-bg`                | `#ffffff` | `#222222` |
| `--mv-text`              | `#212529` | `#dee2e6` |
| `--mv-border`            | `#dee2e6` | `#444444` |

Font: `Lato` (with system-font fallbacks). If the brand palette ever
changes, update `tokens.css` and the two Bootswatch builds together — they
describe the same palette from two angles (runtime CSS vars vs. a compiled
Bootstrap build) and are expected to stay in sync manually; there's no
codegen between them at this project's current scale.

## Dark mode

`prefers-color-scheme: dark` is the default signal. `[data-theme="dark"]` /
`[data-theme="light"]` override it in either direction, so an app-level
theme toggle always wins over the OS setting — stamp `data-theme` on the
root element when a user picks a theme explicitly.

## Using it

Nothing consumes a hand-maintained copy of these files — every consumer
either reads them live or has its build pull them in automatically. There
should never be a second place to edit when the palette or logo changes.

**Keycloak theme** — `docker-compose.yml` bind-mounts this whole `mv-1.0`
directory straight into the theme's resources
(`./branding/mv-1.0:/opt/keycloak/themes/microverse/login/resources/branding:ro`),
so `infrastructure/keycloak/themes/microverse/login/theme.properties`
links `branding/design-system/tokens.css` directly — the real file, not a
copy. Keycloak reads theme files from disk on every request in dev mode
(no build/cache step), so this "just works".

**React (CRA) apps, e.g. taskfusion** — CRA's webpack config
(`ModuleScopePlugin`) refuses to import anything outside `src/`, and it
compiles to a static bundle anyway, so a live mount doesn't help the way
it does for Keycloak. Instead, each app's build pulls the canonical files
in automatically:
- **Docker build**: the Dockerfile `COPY`s `branding/mv-1.0/...` straight
  into `src/assets/brand/` as a build step (see
  `applications/taskfusion/Dockerfile`) — this is why that image's build
  context is the repo root, not just the app's own folder.
- **Local dev** (`npm start` outside Docker): a `prestart`/`prebuild` npm
  script (`scripts/sync-brand-assets.js`) does the same copy from the
  local filesystem.

  Either way, `src/assets/brand/` is gitignored (see root `.gitignore`)
  — it's always generated, never authored in the app's own repo tree.
  The copy mirrors `mv-1.0`'s own folder layout exactly
  (`design-system/`, `logos/`, `images/`) so `tokens.css`'s relative
  `../logos/...`, `../images/...` references resolve unmodified — no
  path rewriting in the sync step.

  Separately, Bootstrap's Sass source uses its `$variables` at *compile*
  time (its color functions like `darken()` need real Sass values, not
  `var()`), so a Bootstrap-based app also keeps a small literal-hex Sass
  copy to feed Bootstrap's variables, e.g.
  `applications/taskfusion/src/assets/scss/_variables.scss`:

  ```scss
  $primary: #2c3e50;   // keep in sync with design-system/tokens.css --mv-color-primary
  $secondary: #95a5a6;
  // ...
  ```

  This one genuinely can't be automated the same way (Sass color
  functions need literal values) — it's the one place that still needs
  manual sync when the palette changes.

**Vue / Svelte (future admin / reports apps)** — same pattern as React:
no Sass compile-time constraint, so just apply the "sync canonical files
into the app's own src/ at build time" mechanism above and import
`tokens.css` once at the app root.

## Assets

- `../logos/microverse-logo.png` — brand mark, referenced by `--mv-logo-url`.
- `../images/microverse-bg.jpg` — brand background image, referenced by
  `--mv-bg-image-url`.
- `../favicons/` and `../fonts/` are scaffolded but currently empty — no
  favicon or self-hosted font files exist yet in the source branding.
