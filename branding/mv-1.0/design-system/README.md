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

**Plain CSS / Keycloak theme** — link `tokens.css` directly, then use the
custom properties (`var(--mv-color-primary)`, etc.) in your own stylesheet.
The `microverse` Keycloak theme
(`infrastructure/keycloak/themes/microverse/login/resources/css/`) does
exactly this.

**React (or any Sass build)** — CSS custom properties work at runtime, but
Bootstrap's Sass source uses its `$variables` at *compile* time (its color
functions like `darken()` need real Sass values, not `var()`). So a
Bootstrap-based app keeps a small Sass copy of the same hex values to feed
Bootstrap's variables, e.g. `applications/taskfusion/src/assets/scss/_variables.scss`:

```scss
$primary: #2c3e50;   // keep in sync with design-system/tokens.css --mv-color-primary
$secondary: #95a5a6;
// ...
```

and separately imports `tokens.css` globally so components can still use
`var(--mv-*)` directly for anything not routed through Bootstrap's Sass
(e.g. this repo's `Notification.js`-style custom components).

**Vue / Svelte (future admin / reports apps)** — import `tokens.css` once at
the app root; there's no Sass compile-time constraint here, so the CSS
custom properties are the single source, used directly.

## Assets

- `../logos/microverse-logo.png` — brand mark, referenced by `--mv-logo-url`.
- `../images/microverse-bg.jpg` — brand background image, referenced by
  `--mv-bg-image-url`.
- `../favicons/` and `../fonts/` are scaffolded but currently empty — no
  favicon or self-hosted font files exist yet in the source branding.
