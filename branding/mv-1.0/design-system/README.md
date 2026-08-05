# Microverse Design System (mv-1.0)

Single source of truth for color, type, spacing, radius and shadow across
every Microverse surface — the React/Vue/Svelte dashboards and the Keycloak
theme. Canonical file: [`tokens.css`](./tokens.css), plain CSS custom
properties with no build step, so it can be linked directly from a Keycloak
`.ftl` theme as well as imported into any frontend framework.

## Palette

Navy/cyan — matches the dashboard mockups in this folder
(`microverse_navbar_light_dark.html`, `microverse_dashboard_full_page*.html`),
which are the source of truth for these values. The Bootswatch builds at
`../themes/{light,dark}/bootstrap.min.css` predate this palette and are now
just historical reference, not something to keep in sync with `tokens.css`
going forward.

| Token                     | Light     | Dark      |
| --------------------------- | --------- | --------- |
| `--mv-color-primary`        | `#0ea5d9` | `#4dd8ff` |
| `--mv-color-primary-contrast` | `#04203b` | `#04203b` |
| `--mv-bg`                    | `#f5f8ff` | `#05061a` |
| `--mv-bg-elevated`           | `#ffffff` | `#0b0f2e` |
| `--mv-text`                  | `#0b0f2e` | `#e8f4ff` |
| `--mv-text-muted`            | `#4a5a8a` | `#9bb8e0` |
| `--mv-border`                | `#c9d9f5` | `#1e2a6b` |
| `--mv-avatar-bg`             | `#0ea5d9` | `#2d5fdb` |
| `--mv-badge-bg`              | `#b4b2a9` | `#5f5e5a` |

`--mv-color-secondary/success/info/warning/danger/light/dark` are
untouched Bootstrap semantic colors, still available for generic
components (alerts, form validation) — the dashboard mockups don't
exercise them, so there was nothing to update there.

Per-service accent colors (one per language, e.g. Go = cyan, Python =
amber, Elixir = purple, Rust = rust-orange, Ruby = red) are **not**
design-system tokens — they live as a local config in whatever component
renders the service grid (e.g. `applications/taskfusion`'s dashboard
page), since they're specific to that one feature rather than
universal.

Font: `Lato` (with system-font fallbacks).

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
