# Microverse Design System (mv-1.0)

Single source of truth for color, type, spacing, radius and shadow across
every Microverse surface — the React/Vue/Svelte dashboards and the Keycloak
theme. Canonical file: [`tokens.css`](./tokens.css), plain CSS custom
properties with no build step, so it can be linked directly from a Keycloak
`.ftl` theme as well as imported into any frontend framework.

## Themes

Microverse ships three brand themes, each with a light and dark mode. All
three use the exact same `--mv-*` token names from `tokens.css` — a theme
only supplies different *values* for the color tokens, never new names —
so no consumer of `tokens.css` needs to change when a theme is added or
switched.

Each theme is a self-contained bundle under `themes/<id>/`. `images/` only
appears for themes that have their own unique artwork (Vienna, Uhuru) —
Default doesn't, so it has no `images/` folder and no `fonts/`/`logos/`
either, since nothing uses a theme-specific font or logo today (same
reasoning that removed the old top-level `favicons/`/`fonts/` scaffolding
— see [Assets](#assets)). Default's legacy Bootswatch builds (see
[Palette](#palette-default-theme)) live under its own `bootswatch/`
subfolder, historical reference only:

```
themes/
  theme.config.json
  default/
    css/{light,dark}.css
    bootswatch/{light,dark}/bootstrap.min.css   (historical, unused)
  vienna/
    css/{light,dark}.css
    images/vienna-grossglockner-bg.jpg
  uhuru/
    css/{light,dark}.css
    images/uhuru-kilimanjaro-bg.jpg
```

| Theme     | Modes         | Primary  |
| --------- | ------------- | -------- |
| Default   | Light / Dark  | Blue     |
| Vienna    | Day / Night   | Pine     |
| Uhuru     | Dawn / Dusk   | Ember    |

[`themes/theme.config.json`](./themes/theme.config.json) is the catalog of
available themes (id, dir, css/backgroundImage paths, per-mode labels) —
but it does **not** decide which one is active. That's
`MICROVERSE_BRAND_THEME` in the root `.env` (one of `default` / `vienna` /
`uhuru`) — one variable, baked into **both** images so they can't drift
apart:

- **taskfusion** — `docker-compose.yml` passes it as a
  `REACT_APP_BRAND_THEME` build arg to `applications/taskfusion/Dockerfile`.
  `src/index.js` `require()`s only `themes/<id>/css/{light,dark}.css`
  (CRA inlines `process.env.REACT_APP_BRAND_THEME` to a literal string
  before webpack resolves the path, so exactly one theme's CSS ends up in
  the bundle, not all three), and `src/context/ThemeContext.js` sets
  `data-brand-theme` on `<html>` once at startup so the bundled CSS's
  `[data-brand-theme="<id>"]` selectors actually match. Mode (light/dark)
  is the separate, runtime-toggleable `data-theme` attribute the same
  context already managed.
- **Keycloak** — `docker-compose.yml` passes it as a `KEYCLOAK_BRAND_THEME`
  build arg to `infrastructure/keycloak/Dockerfile`. Keycloak's login page
  has no JS runtime to set `data-brand-theme` the way taskfusion does, so
  the Dockerfile takes a different approach: it `sed`s the selected
  theme's `css/light.css`/`css/dark.css` in place, rewriting
  `[data-brand-theme="<id>"]` to bare `:root` (making the rules apply
  unconditionally instead of never matching), then fills in two
  placeholder tokens — one in `theme.properties`' `styles=` line (to
  actually load those two files) and one in `resources/css/microverse.css`
  (to point `--mv-bg-image-url` at the theme's own image, since Default
  has no image of its own — see its own comments for the full mechanism).

Because both are build-time bakes, changing the theme means rebuilding
*both* images, not just restarting the containers.
`theme.config.json`'s `defaultTheme` is only the fallback used when the
env var is unset — keep every consumer in agreement if you ever change it.

Mechanically, each `css/light.css` / `css/dark.css` pair scopes its
overrides under `[data-brand-theme="<id>"]`, combined with `tokens.css`'s
existing `[data-theme="light"|"dark"]` attribute for mode — the same
cascade pattern `tokens.css` already uses for `prefers-color-scheme` vs.
an explicit user choice. Tokens that don't change between modes
(secondary/success/danger/avatar/primary-contrast/background-image) live
in `light.css` only and simply carry through; `dark.css` overrides just
the tokens that actually change. With no `data-brand-theme` attribute set
anywhere, `tokens.css`'s bare `:root` block continues to apply unchanged
(today's Default palette), so this is backwards compatible with every
existing consumer.

Each theme's `--mv-bg-image-url` points at its own photo: Vienna at
Grossglockner (Austria's highest peak, in the Alps the Schönbrunn/Belvedere
story draws from), Uhuru at Kilimanjaro (Tanzania, home to *Uhuru na
Umoja*, the motto the theme's name and hero line come from). Filenames are
listed in each theme's `backgroundImage` entry in `theme.config.json`, not
a shared `bg.jpg` — the Dockerfile's `COPY` lines and
`scripts/sync-brand-assets.js` reference them by that entry, so a renamed
image needs updating in `theme.config.json` and the Dockerfile.

Full palette rationale and mockups for each theme live in
[`mock-ups/`](./mock-ups/) (`default-design-system.html`,
`vienna-design-system.html`, `uhuru-design-system.html`) — these are the
source of truth for the hex values in `themes/*/css/*.css`. Vienna and
Uhuru also have `VIENNA-DESIGN.md` / `UHURU-DESIGN.md` write-ups of the
story behind each palette; those two are gitignored (kept local-only, not
published to the repo) since they contain personal narrative rather than
technical documentation.

## Palette (Default theme)

Navy/cyan — matches the dashboard mockups in this folder
(`microverse_navbar_light_dark.html`, `microverse_dashboard_full_page*.html`),
which are the source of truth for these values. The Bootswatch builds at
`themes/default/bootswatch/{light,dark}/bootstrap.min.css` predate this
palette and are now just historical reference, not something to keep in
sync with `tokens.css` going forward.

**This table does not match `themes/default/css/*.css`.** The table below
is `tokens.css`'s existing bare `:root`/`[data-theme]` palette — navy/cyan,
`--mv-color-primary: #0ea5d9` — which is what every current consumer
(Keycloak, taskfusion) actually renders today. `themes/default/css/*.css`
instead carries the *blue* palette (`#2B5FD9`) from `mock-ups/default-design-system.html`,
the new mockup that was designed as a matched set with Vienna and Uhuru.
These are two different palettes both called "Default." Reconciling them —
either updating `tokens.css`'s base values to the new blue, or keeping
navy/cyan as the real default and renaming the new palette — is an open
decision for whoever wires up brand-theme switching; nothing in this repo
does that yet.

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

**Keycloak theme** — `infrastructure/keycloak/Dockerfile` `COPY`s the
whole `design-system/` directory into the image at build time (all three
themes — a handful of small files, simpler than curating a per-file list
and keeping it in sync), mirroring its layout under `resources/branding/`
so every relative `./logos/...`, `./images/...` reference still resolves.
A build step then bakes in `KEYCLOAK_BRAND_THEME` (see
[Themes](#themes) for the exact mechanism — `sed`-rewriting the selected
theme's CSS and filling in two placeholder tokens, since Keycloak has no
JS runtime to react to an env var the way taskfusion does).
`docker-compose.yml` doesn't bind-mount `branding/` anywhere, so any
palette, asset, or theme change needs an image rebuild
(`docker compose build microverse-keycloak`), not just a container
restart.

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
  The copy mirrors `mv-1.0`'s own folder layout exactly (`design-system/`
  and everything under it — `tokens.css`, `logos/`, `images/`, `themes/`)
  so `tokens.css`'s relative `./logos/...`, `./images/...` references
  resolve unmodified — no path rewriting in the sync step.

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

`logos/` and `images/` are siblings of this file — both live directly
under `design-system/`, not one level up under `mv-1.0/`.

- [`logos/microverse-logo.png`](./logos/microverse-logo.png) — brand mark,
  referenced by `--mv-logo-url`. Shared across every theme; no
  theme-specific logo exists.
- [`images/microverse-bg.jpg`](./images/microverse-bg.jpg) — Default
  theme's background image (referenced by `--mv-bg-image-url` in
  `tokens.css`'s bare `:root`; `themes/default/css/light.css` inherits it
  rather than redeclaring it — see [Themes](#themes)).
- Vienna and Uhuru's own background images live at
  `themes/vienna/images/vienna-grossglockner-bg.jpg` and
  `themes/uhuru/images/uhuru-kilimanjaro-bg.jpg` — see [Themes](#themes).
- Top-level `favicons/`/`fonts/` and per-theme `fonts/`/`logos/` were
  removed rather than kept as empty scaffolding — nothing references a
  favicon or a self-hosted/theme-specific font or logo today. Recreate
  them if that changes.
- `themes/default/bootswatch/{light,dark}/bootstrap.min.css` — the old
  pre-`tokens.css` Bootswatch builds mentioned in
  [Palette](#palette-default-theme), historical reference only.
