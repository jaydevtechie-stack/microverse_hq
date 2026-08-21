# Contributing to Microverse

This documents the workflow actually used in this repo, reverse-engineered from its git history rather than aspirational — if reality and this file ever disagree, update this file.

## Branching strategy

- **`develop`** — the default working branch. All day-to-day work targets this, not `main`.
- **`main`** — stable. It only moves when `develop` is genuinely ready to be called a release point.
- **Topic branches** — cut from `develop`, named `<type>/<slug>`:
  - `feature/<slug>` — new functionality (e.g. `feature/gofeeler-assign-to-user`)
  - `fix/<slug>` — bug fixes (e.g. `fix/task-uuid-and-splitview-width`)
  - `docs/<slug>` — documentation-only changes (e.g. `docs/roadmap-next-steps`)
  - `infra/<slug>` — infrastructure/build/deploy changes (e.g. `infra/keycloak-dockerfile-branding`)
  - `chore/<slug>` / `refactor/<slug>` — used occasionally for maintenance work that isn't a feature or fix

**Branches map to roadmap items, not the other way around.** Each git branch corresponds to a phase entry in [docs/roadmap/](../docs/roadmap/) (e.g. "Branch 4.1", "Phase 10") — the roadmap's unit of work is called a phase; the git branch is just where that phase's work happens to live during development, a different sense of the word. Default to one branch per roadmap item; split off a dedicated branch for a sub-item (e.g. 4.1.1) only when it's substantial enough to deserve its own review cycle separate from its parent item — small sub-items ride along in the parent branch instead. Either way, the branch's slug or its PR/first commit should make the roadmap number unambiguous, so `git log`/PR history can be traced straight back to a roadmap entry.

Open a PR from the topic branch into `develop`. Keep branches scoped to one roadmap item or one coherent change — the history is full of single-purpose branches (one GoFeeler roadmap branch/sub-item per PR) rather than large multi-topic ones.

**Push permissions:** an AI agent (e.g. Claude) may push commits directly to `feature/*`, `fix/*`, `docs/*`, and `infra/*` topic branches. `develop` is reviewed and merged by the maintainer only — an agent must never push to or merge into `develop` directly, even if a topic branch's PR looks ready.

## Commit messages

Loosely [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`.

- **Types used:** `feat`, `fix`, `docs`, `chore`, `refactor`, `infra`. Avoid `wip` except for genuinely parked, unfinished work — it shows up rarely and deliberately in this history, not as a habit.
- **Scope** is almost always the component the change touches, matching folder/service names: `taskfusion`, `task-service`, `asset-service`, `search-service`, `keycloak`, `branding`, `nginx`, `docker`, etc. Omit the scope only when a change is genuinely cross-cutting (e.g. a bare `docs:` commit touching multiple docs at once).
- When a commit implements a specific roadmap item, reference it in parentheses at the end, matching the numbering in [docs/roadmap/](../docs/roadmap/) — e.g. `feat(taskfusion): real Project Hub + Admin pages, roles applied (4.0.3)`. This is what makes it possible to trace "when did Branch 4.1 actually land" straight from `git log`.

## Docs stay in sync with code

This repo treats [docs/architecture/](../docs/architecture/), [docs/roadmap/](../docs/roadmap/), and [docs/schema.md](../docs/schema.md) as living documents, not a one-time spec:

- If a PR changes what's actually built, update the relevant `docs/roadmap/*.md` status markers (✅/🟢/🟡/⚪) in the same PR, not as a follow-up.
- If a PR changes a real, migrated table shape, update [docs/schema.md](../docs/schema.md) — that file explicitly defers to the real migrations as source of truth, but only stays useful if it's kept honest.
- If a PR closes a security gap listed in [docs/security.md](../docs/security.md)'s "Known gaps," remove it from there too.
- It's normal and expected for a branch to be docs-only (`docs/<slug>`) when a design decision needs writing down before or after the code that implements it.

## Pull requests

- Merged into `develop` via GitHub PR (regular merge, not squash — the branch's individual commits stay visible in history).
- One topic branch per roadmap item/sub-item where practical, so a PR maps cleanly to one entry in [docs/roadmap/](../docs/roadmap/).

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
