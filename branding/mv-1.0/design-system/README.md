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

Each theme is a self-contained bundle under `themes/<id>/`, always shaped
the same way **by convention**, not by anything reading `theme.config.json`
at build time: `css/light.css` + `css/dark.css` (required), and an
`images/` folder holding exactly one file — the theme's own background
photo — for themes that have unique artwork (Vienna, Uhuru). Default
doesn't have one, so it simply has no `images/` folder; nothing
special-cases that, it just falls through (see below). Default's legacy
Bootswatch builds (see [Palette](#palette-default-theme)) live under its
own `bootswatch/` subfolder, historical reference only:

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

[`themes/theme.config.json`](./themes/theme.config.json) is reference
documentation only (id, label, per-mode labels, description) — nothing
reads it at build time, and it does **not** decide which theme is active.
That's `MICROVERSE_BRAND_THEME` in the root `.env`, set to a theme's dir
name (`default` / `vienna` / `uhuru`) — one variable, baked into **both**
images at build time so they can't drift apart. **Neither app's source
code, nor Keycloak's static theme files, ever reference a theme id or
know the other themes exist** — both Dockerfiles (and taskfusion's local-
dev `scripts/sync-brand-assets.js`) do all the deciding, by copying only
the selected theme's files into fixed, theme-agnostic destination paths:

- `design-system/theme/light.css` and `.../dark.css` — the selected
  theme's own CSS, with its `[data-brand-theme="<id>"]` selector rewritten
  to bare `:root` in the copy (that selector exists so the *source*
  catalog above can hold all three themes color-scoped at once; once only
  one theme's file is ever present, the gate is pointless — worse, for
  Keycloak, which has no JS runtime to set `data-brand-theme` at all, it
  would mean the rules never match anything).
- `design-system/images/microverse-bg.jpg` — the shared canonical
  background image, always present (Default's own). If the selected
  theme has its own `images/` folder, its one file **overwrites** this
  canonical one; if not (Default), it's simply left alone — the fallback
  is "do nothing," not a second code path.

taskfusion's `src/index.js` imports those two fixed CSS paths directly
(plain `import`, no template literals or `require()` needed — the
decision already happened at build time), and neither
`src/context/ThemeContext.js` nor any other app code references
`MICROVERSE_BRAND_THEME` or `data-brand-theme` at all anymore; that
context only ever handles light/dark mode. Keycloak's
`theme.properties`/`microverse.css` are equally static, always pointing
at the same fixed paths.

Because both are build-time bakes, changing the theme means rebuilding
*both* images, not just restarting the containers.
`theme.config.json`'s `defaultTheme` is only the fallback both
Dockerfiles use if the env var is unset.

Mechanically, each *source* `css/light.css` / `css/dark.css` pair (under
`themes/<id>/`, before either build step touches it) scopes its overrides
under `[data-brand-theme="<id>"]`, combined with `tokens.css`'s existing
`[data-theme="light"|"dark"]` attribute for mode — the same cascade
pattern `tokens.css` already uses for `prefers-color-scheme` vs. an
explicit user choice. Tokens that don't change between modes
(secondary/success/danger/avatar/primary-contrast) live in `light.css`
only and simply carry through; `dark.css` overrides just the tokens that
actually change. With no `data-brand-theme` attribute set anywhere,
`tokens.css`'s bare `:root` block continues to apply unchanged (today's
Default palette), so this is backwards compatible with every existing
consumer.

Vienna's photo is Grossglockner (Austria's highest peak, in the Alps the
Schönbrunn/Belvedere story draws from); Uhuru's is Kilimanjaro (Tanzania,
home to *Uhuru na Umoja*, the motto the theme's name and hero line come
from). Adding a theme's own image is just dropping one file into its
`images/` folder — no code, config, or Dockerfile change needed to pick
it up.

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

**Keycloak theme** — `infrastructure/keycloak/Dockerfile` `COPY`s
`tokens.css`, `logos/microverse-logo.png` and `images/microverse-bg.jpg`
into the image at build time, mirroring `design-system/`'s layout under
`resources/branding/` so every relative `./logos/...`, `./images/...`
reference still resolves. The full `themes/` catalog is also copied in,
but only to a scratch path (`/tmp/themes-catalog`) a `RUN` step reads from
to populate the fixed `resources/branding/design-system/theme/` path —
see [Themes](#themes) for the exact mechanism — then deletes; the shipped
image never carries the other two themes' source files.
`docker-compose.yml` doesn't bind-mount `branding/` anywhere, so any
palette, asset, or theme change needs an image rebuild
(`docker compose build microverse-keycloak`), not just a container
restart.

**React (CRA) apps, e.g. taskfusion** — CRA's webpack config
(`ModuleScopePlugin`) refuses to import anything outside `src/`, and it
compiles to a static bundle anyway, so a live mount doesn't help the way
it does for Keycloak. Instead, each app's build pulls the canonical files
in automatically, doing the same "copy only the selected theme" work
Keycloak's Dockerfile does — see [Themes](#themes):
- **Docker build**: `applications/taskfusion/Dockerfile` `COPY`s
  `tokens.css`/`logos/`/`images/` in directly, then the full `themes/`
  catalog to a scratch path a `RUN` step reads from and discards — this
  is why that image's build context is the repo root, not just the app's
  own folder.
- **Local dev** (`npm start` outside Docker): a `prestart`/`prebuild` npm
  script (`scripts/sync-brand-assets.js`) does the equivalent in Node
  instead of shell (`fs.readFileSync`/`.replace()`/`fs.writeFileSync`
  rather than `sed`), reading `REACT_APP_BRAND_THEME` from the local
  shell environment the same way CRA's dev server would.

  Either way, `src/assets/brand/` is gitignored (see root `.gitignore`)
  — it's always generated, never authored in the app's own repo tree.
  `tokens.css`, `logos/`, and `images/` mirror `mv-1.0/design-system/`'s
  own layout exactly so its relative `./logos/...`, `./images/...`
  references resolve unmodified, but `design-system/theme/` has no
  equivalent under `mv-1.0/` — it only exists inside each consumer's own
  copy, holding whichever theme was selected.

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
