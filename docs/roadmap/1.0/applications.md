# Roadmap — applications

See [docs/roadmap/1.0/core.md](core.md) for the status key and [docs/architecture/1.0/applications.md](../../architecture/1.0/applications.md) for the UI/dashboard design this implements.

## Proposals

### Landing page layout — master-detail split view
**Approach:** the Orders/Tasks list, Create Order form, and Order/Task detail view are one screen, not three separate page navigations. Clicking a list row or "+ New" shrinks the list to a 50% column and slides in the relevant panel (detail or create) to fill the other half — content actually grows to use the space rather than staying at a fixed narrow width inside a wider viewport. (First pass used a fixed ~260px sidebar; too cramped once real detail content — the role-specific action panels — had to fit in it.) Mockup saved as `gofeeler_landing_page` in the design system.

**Mobile fallback:** below a breakpoint, this pattern doesn't fit — the list disappears entirely instead of shrinking to a sliver, and whichever panel is active takes the full width. Stacked single-panel navigation, not a cramped split.

**Share icon group:** the detail panel header includes copy-link, email, and generic share icons (not on the Create Order panel — nothing to share until an Order exists). What "copy link" copies is a deep link to the Order/Task, gated by the same role-based access as everything else — a copied link doesn't bypass permission checks for whoever it's shared with.

**Implementation warning:** don't mix `flex: 1` (or Tailwind's `flex-1`) with JS-driven `width` toggling on the same element — `flex-basis` from the shorthand overrides `width` silently, which caused both panels to render simultaneously in the mockup. Toggle the `flex` shorthand itself (or use a single mutually-exclusive state value — `activePanel: 'list' | 'detail' | 'create'` — rather than independent boolean flags that can both end up true).
