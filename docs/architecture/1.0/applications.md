# Architecture — applications

The front doors (TaskFusion, Admin, LAReports) — user-facing surfaces that consume the domain/business/platform services described in [domain-services.md](domain-services.md), [business-services.md](business-services.md), and [platform-services.md](platform-services.md). Cross-cutting model (roles, entity model, task workflow) lives in [core.md](core.md).

## Dashboard / UI notes

- Domain-service cards use `heroImage` (or a tinted icon block), `name`, `description`; `onOpen` does a full page navigation to the service's own subdomain — the dashboard is a launcher, not an iframe host.
- Plumbing (platform-services) gets an internal ops view, badged by language-homage color + generic functional icon (not customers-facing).
- Admin dashboard needs a status filter (All / Online / In progress) rather than always showing raw build status.
- Orders/Tasks landing page: status, deadline, assignee (linked), green/yellow/red urgency dot, link to customer. Unassigned gets a neutral gray dot, not forced into the urgency scale.
- Theme: sampled from a starfield/network background image — dark mode stays close to the source (deep navy `#05061A`/`#0B0F2E`, cyan accent `#4DD8FF`), light mode inverts role rather than literal color (deep navy becomes the accent/text color, cyan lightens to `#0EA5D9` for contrast on white).
- **Navigation** (superseded by 4.3 — see [docs/roadmap/1.0/domain-services.md](../../roadmap/1.0/domain-services.md)'s 4.3 entry): role-based nav tree, per-role structure and rationale captured in [nav-config.json](nav-config.json) (`platform:customer`/`platform:analyst`/`platform:reviewer` unchanged from earlier drafts; `platform:project-manager` gets Projects/Orders/Delivery team; new `platform:account-manager` role gets Customers/Billing; `platform:admin` stays one top-level item — no longer holding global Orders or Billing). Delivery team's Analysts/Reviewers and Admin's Users/Services/Settings/Audit-log are **not** navbar dropdowns — each renders as an in-page Subnav tab row on that section's own page (DeliveryTeamPage.js, AdminPage.js), matching the finalized design in [platform_projects_hub_and_admin.html](../../../branding/mv-1.0/design-system/mock-ups/platform_projects_hub_and_admin.html)'s `#subnav`. Wired into Navbar.js/App.js as of 4.3 — PM no longer also picks up `platform:customer`'s/`platform:analyst`'s own links the way it did pre-4.3 (that collided with Delivery team's own "Analysts" item). `platform:account-manager`'s routes exist but are unreachable until that role is provisioned in Keycloak. Services admin capabilities: activate/deactivate a service platform-wide, add a new service on release, edit a service's card details — real as of 4.4, backed by the `services` table ([docs/schema.md](../../schema.md)), not just spec'd. **Avatar (top-right)** opens a dropdown with My Profile (4.0.4) and Log out — the standard, expected spot for both, not a separate nav item.

## GoFeeler end-to-end flow (first fully designed service flow)

Worked example using the real GoFeeler test users: Luke (customer), Matthew (project-manager), Mark (analyst), John (reviewer).

1. **Luke** creates an Order on GoFeeler's Create Order page (`platform:customer` + `service:gofeeler`) — uploads content via a field that stores to MinIO.
2. **Matthew** (`platform:project-manager` + `service:gofeeler`) gets a notification (bell icon, unread count, popup on click); clicking it loads the order page.
3. **Scout** (the recommendation agent) populates a word-cloud element with candidate analysts (human or agentic), sized/weighted by fit.
4. Matthew selects **Mark** → order becomes an assigned Task.
5. **Mark** sees the notification, opens the task, clicks "Analyse." The task page includes a sentiments multiselect element. GoFeeler returns sentiment scores (LLM integration being considered for this step).
6. Mark reviews the text, can add versioned notes/comments, adds recommendations if results are sufficient, then moves the task to review — **default reviewer is the PM** (Matthew), or can be reassigned to a dedicated `service:gofeeler` + `platform:reviewer` holder like **John**.
7. Reviewer approves → bill created for Luke → Luke pays *(payment flow itself is a later roadmap item)*.

**UI pattern:** steps 2–7 all happen on one unified Order/Task detail page, not separate forms per step — the available actions render based on `(viewer's platform role, task's current state)`. A PM sees the analyst picker only when status is unassigned; an analyst sees "Analyse" and notes only while assigned to them; a reviewer sees approve/reject only in the reviewer state; a customer gets a read-only view with download unlocked once paid. The list, this detail view, and the Create Order form live on one screen as a master-detail split view — clicking a row shrinks the list and slides in the relevant panel, filling the reclaimed width rather than staying narrow. Below a mobile breakpoint this falls back to stacked single-panel navigation instead of a cramped split (see [docs/roadmap/1.0/applications.md](../../roadmap/1.0/applications.md) for the layout details and a CSS gotcha worth knowing before implementing it).

**Build sequence:** see [docs/roadmap/1.0/domain-services.md](../../roadmap/1.0/domain-services.md)'s GoFeeler section for the branch plan (form scaffold → dynamic detail view with dummy data → real form functionality → task detail functionality → LLM integration → search-service → notifications & messaging → auditing & efficiency → billing & payouts).
