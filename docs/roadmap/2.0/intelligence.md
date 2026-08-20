# Microverse — intelligence roadmap

What's getting built for the `intelligence/` layer, roughly in order. Distinct from [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) (the domain-service build sequence) — this is specifically the agentic-workforce piece flagged as an open question in [docs/architecture/1.0/core.md](../../architecture/1.0/core.md): *"`intelligence/` folder taxonomy (agents, ai-tools, knowledge, mcp, memory, models, prompts, workflows) — which of these are actual runnable services vs. just config/artifacts other services consume."* This doc is that question, answered and sequenced. See [docs/business/2.0/intelligence.md](../../business/2.0/intelligence.md) for why any of this is worth building.

**Status key:** ✅ Done · 🟢 Now · 🟡 Next · ⚪ Later

## Prior art: Scout

Before `intelligence/` existed as a named folder, **Scout** ([docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) 4.1.1) was already doing agentic work — the recommendation agent that ranks candidate analysts/reviewers by availability, backed by `models/scout.js`, exposed via `GET /tasks/:id/recommended-analysts`. It's read-only (recommends, doesn't assign) and its signal is an explicit proxy, not real measurement (see [docs/schema.md](../../schema.md)'s `assigned_at` note). Worth treating as the reference implementation for everything below rather than starting from zero — it's the existing example of an agent that (a) has a real decision function, (b) is honest about what it doesn't actually know yet, and (c) ships as a query other code calls, not a black box.

## Resolving the intelligence/ taxonomy — which subfolders are runnable

Resolves [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s open question on this.

| Folder | Runnable, or artifact? | Notes |
|---|---|---|
| `agents/` | Runnable | Each subfolder (gis-analyst, image-analyst, planner, qa-agent, report-writer, research-agent) is a real participant in the existing Analyst/PM/Reviewer role model — not a new tier, just an agentic occupant of tiers already designed for it. |
| `ai-tools/` | Mostly artifact | Shared capability wrappers (classification, embeddings, extraction, ocr, summarization, vision) that agents call into — a library, not independently running services, unless/until enough agents share load that it's worth its own process. |
| `knowledge/` | Artifact | Reference corpus. Starts empty — see Phase 6. |
| `memory/` | Undecided | Per-task agent working state. Could be a real backing store, or could reuse `task_comments` with a new visibility value. See Open questions. |
| `models/` | Mostly artifact | Config referencing external providers, plus decision code like `models/scout.js`. Only becomes "runnable" if something needs a self-hosted served model rather than an API call. |
| `prompts/` | Artifact | Versioned system prompts — text, no runtime behavior of its own. |
| `mcp/` | Runnable | The one piece that has to be live infrastructure — MCP servers wrapping task-service/asset-service/search-service so agents can actually *act*, not just read. Everything else in `agents/` is inert without this. |
| `workflows/` | Undecided | Risk of overlapping the existing `workflow` (Camunda) business service. See Open questions — same shape of problem as the earlier `messaging`/`event-bus` naming collision. |

## Agent-to-role mapping

| Agent | Maps to | Notes |
|---|---|---|
| `gis-analyst` | `platform:analyst` + `service:springpix` | SpringPix's raster hotspot analysis is exactly the shape this was named for. Blocked on SpringPix itself — still "Up next," not yet planned in detail per [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md). |
| `image-analyst` | `platform:analyst` + `service:springpix` (possibly `service:pyreel` later, for video frames) | Can work the same Task alongside gis-analyst, or independently. |
| `planner` | `platform:project-manager`, any service scope | The fuller successor to Scout — Scout recommends, planner actually claims from the pool and executes `unassigned → analyst` with no human click. This is the concrete home for the original idea: *a human or agentic PM assigns to a human or agentic analyst.* |
| `qa-agent` | `platform:reviewer` | Slots directly into the existing `analyst → reviewer → done` transition — no new workflow state needed. |
| `report-writer` | Not a role in today's model | Analyst/PM/Reviewer are the only three today. Either folds into the analyst/reviewer step's existing note-authoring, or earns its own `platform:report-writer` role later once it's doing distinct enough work. Don't force this before it's needed. |
| `research-agent` | Not a role in today's model | Same situation as report-writer — more likely a sub-step other agents call than a Task-workflow assignee in its own right. |
| `agent-supervisor` *(new)* | `platform:agent-supervisor` | Not one of the original six `agents/` subfolders — needs adding. Distinct from PM on purpose (see [docs/business/2.0/intelligence.md](../../business/2.0/intelligence.md)). Human-or-agentic like every other role here, except the specific act of approving a Phase 7 proposal requires a human assignee — see Agent security model below. |

## What each agent actually does

The mapping table above says *which role* each agent fills. This is *what it does inside that role* — trigger, inputs, which `ai-tools` it calls, what it hands off, and to whom. Confidence varies a lot across these six — some are direct successors to things that already exist (Scout), others are undesigned until a blocking dependency (SpringPix) shows up. Flagged honestly per agent rather than written with uniform confidence.

**`gis-analyst`**
- **Trigger:** a Task on `service:springpix` moves `unassigned → analyst` with gis-analyst as assignee.
- **Input:** raster/GIS files pulled via `asset-service` (MinIO), plus whatever brief is in the Task's `context` field.
- **Calls:** `ai-tools/vision` (feature/hotspot detection on the raster data), `ai-tools/extraction` (turning detected regions into structured coordinates), possibly `ai-tools/embeddings` if comparing against prior hotspot patterns held in `knowledge/`.
- **Hands off:** structured findings (regions of interest, coordinates, confidence) as an internal `task_comments` note or a `memory/` artifact — goes to `qa-agent` for review, then to `report-writer` for the customer-facing writeup.
- **Reality check:** blocked entirely until SpringPix exists as a real service. Everything above is a design target, not something with a system to call yet.

**`image-analyst`**
- **Trigger:** same shape as gis-analyst — `service:springpix` today, plausibly `service:pyreel` later for extracted video frames.
- **Input:** uploaded photos/images via `asset-service`.
- **Calls:** `ai-tools/vision` (primary — object/condition detection), `ai-tools/ocr` (if an image contains embedded text — signage, labels, photographed documents), `ai-tools/classification` (categorizing what's in frame).
- **Hands off:** same pattern as gis-analyst — structured findings to `qa-agent`, then `report-writer`.
- **Relationship to gis-analyst:** can run on the same Task in parallel rather than in sequence — gis-analyst covers the spatial/raster layer, image-analyst covers the photographic layer, and `report-writer` merges both into one deliverable rather than either agent owning the full picture alone.

**`planner`**
- **Trigger:** runs against the unassigned pool continuously or on new-Order events — not tied to one Task's lifecycle the way the analyst-role agents are.
- **Input:** the pool-claim query itself (`SELECT ... WHERE status = 'unassigned' ... FOR UPDATE SKIP LOCKED`), and Scout's existing availability ranking as its v1 decision rule.
- **Calls:** none, initially — v1 is Scout's heuristic with write access added, not an LLM-driven decision. A `classification`-based routing step (by task content/complexity rather than pure availability) is a plausible v2, not a v1 feature.
- **Hands off:** an assigned Task (`unassigned → analyst`) — the same end effect a human PM clicking "assign" produces today.
- **Reality check:** don't oversell v1 as smarter than it is. It's Scout plus the ability to act, not a new decision engine.

**`qa-agent`**
- **Trigger:** a Task enters `reviewer` state with qa-agent as assignee, in place of the default human reviewer (the PM, or a dedicated `service:X` + `platform:reviewer` holder — see [docs/architecture/1.0/applications.md](../../architecture/1.0/applications.md)'s GoFeeler flow).
- **Input:** the analyst's completed work — findings, notes, whatever was attached — plus the original Task context.
- **Calls:** `ai-tools/classification` (pass/fail/flag judgment), `ai-tools/summarization` (condensing analyst notes into something it can reason over).
- **Hands off:** an approve (`→ done`) or reject (`→ analyst`, with a new assignee picked immediately, matching the existing rejection rule) — the same state-machine effect a human reviewer produces.
- **Open question, not yet resolved:** is the bar identical to a human reviewer's judgment, or a narrower automated-check subset (required fields present, format correct) rather than genuine quality judgment? This is Phase 4's open item, not settled here.

**`report-writer`**
- **Trigger:** after a Task reaches `done` — or potentially folded into the analyst step itself rather than a separate pass, which is still unresolved (see the mapping table above).
- **Input:** gis-analyst/image-analyst's structured findings, Task context, any customer-facing notes (`task_comments` where `visibility = 'customer'`).
- **Calls:** `ai-tools/summarization` (primary), `ai-tools/extraction` (pulling specific stats/figures worth featuring), `knowledge/` (referencing past reports for tone/format consistency, once Phase 6 populates it).
- **Hands off:** the actual Deliverable ([docs/business/1.0/overview.md](../../business/1.0/overview.md)'s glossary term) — attached via `asset-service`, unlocked for the customer once the Task hits `paid`.
- **Reality check:** not an assignee in today's three-role model. Most likely a step other agents call rather than something holding its own `platform:*` claim — unless it earns one later, per the roadmap's open question.

**`research-agent`**
- **Trigger:** called by another agent mid-task (gis-analyst wanting historical comparison data, report-writer wanting supporting context) rather than assigned to a Task directly.
- **Input:** whatever the calling agent hands it — a query, a region, a topic.
- **Calls:** `ai-tools/embeddings` + `ai-tools/extraction` (semantic search over `knowledge/`, pulling relevant facts out of longer source material), `ai-tools/summarization` to condense before handing back.
- **Hands off:** a research brief back to the calling agent — not a customer-facing artifact on its own.
- **Reality check:** the most speculative of the six. No concrete Microverse service maps onto it the way SpringPix maps onto gis-analyst — it reads more like a utility every other agent might call than a Task-workflow participant in its own right.

## ai-tools — what each capability does, and who calls it

| Tool | What it does | Called by |
|---|---|---|
| `classification` | Labels or categorizes content — sentiment tags, pass/fail checks, image content categories | GoFeeler's sentiment analysis (Phase 2 / [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) Phase 5), `qa-agent`'s approve/reject judgment, `image-analyst`'s content categorization |
| `embeddings` | Turns content into vectors for semantic similarity/search | `research-agent`'s `knowledge/` lookups; a plausible later input to smarter `planner` routing |
| `extraction` | Pulls structured fields out of unstructured input | `gis-analyst` (coordinates/regions from raster data), `report-writer` (stats/figures worth featuring), `research-agent` (facts from source material) |
| `ocr` | Reads text out of images or scanned documents | `image-analyst` (signage, labels, photographed documents); potentially GoFeeler if chat exports ever arrive as screenshots rather than text |
| `summarization` | Condenses longer content into shorter form | `report-writer` (primary use case), `qa-agent` (condensing analyst notes), `research-agent` (condensing findings before handoff) |
| `vision` | Visual feature/object detection in images and raster data | `gis-analyst` and `image-analyst` — by far the two heaviest users |

Every row above is a shared capability, not a per-agent reimplementation — the same reasoning `ai-tools/` was given in the taxonomy table: build `classification` once for GoFeeler's Phase 5, and `qa-agent`/`image-analyst` get it for free rather than each growing their own copy.

## Agent security model

How an agent gets stopped from doing work it isn't authorized for, and from acting somewhere it shouldn't. Four layers, mostly reusing mechanisms that already exist rather than inventing new ones — plus one stated rule for judging future agent capabilities that don't fit the first three.

**Layer 1 — role-based pool filtering.** Already built, no new work: [docs/architecture/1.0/business-services.md](../../architecture/1.0/business-services.md)'s task pool query is `WHERE status = 'unassigned' AND service = ANY(:user_roles)`. Once an agent's Keycloak identity (see below) holds only `platform:analyst` + `service:springpix`, it structurally cannot see a GoFeeler task, let alone claim one — same query, same filter a human analyst hits. The discipline this needs isn't code, it's not over-granting roles to an agent's identity "in case it needs them later."

**Layer 2 — `mcp/` scoping, narrower than the role would technically permit.** A human only ever sees actions the frontend chose to render; an agent has no frontend, only whatever endpoints its MCP server exposes. Phase 5's contract-endpoint exclusion for `planner` is the first instance of this: the role model would *also* block that action, but scoping the tool surface too means two independent reasons it fails, not one. Generalize it — every MCP server given to an agent exposes only the specific endpoints that agent's job needs, not the full surface its role would allow.

**Layer 3 — blast radius, the rule for judging what needs a human.** Not "agents can't act" — a Task-level action (an analyst finishes work, a reviewer rejects) is bounded and reversible, and stays fully agentic. An action that compounds across every future Task (retuning a model, changing routing weights, approving another agent's supervisor action) needs a human, because getting it wrong doesn't cost one Task, it costs everything downstream. This is the reasoning already applied to Phase 7's approval gate and the contract boundary — stated here explicitly so the next new agent capability gets checked against a rule instead of re-argued from scratch.

**Layer 4 — attribution, for detection rather than prevention.** [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) Phase 8's audit log already covers status/owner changes. Tagging actor identity as human-or-agent makes every logged action attributable after the fact — and it's what makes Phase 7's dark-task audit sampling meaningful in the first place, since sampling only works if there's a trustworthy log to sample from.

**Agent identity, underneath all four layers: Keycloak service accounts.** Each agent is a Keycloak client with service accounts enabled, authenticating via the client-credentials grant rather than a login — and roles get assigned to that service account exactly like a human user, which is what makes [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s "agents are simply assigned roles the same way" literally true at the mechanism level, not just a design intent. This also answers what used to be an open question here: whether an agentic Analyst/PM/Reviewer needs its own `users` row — yes, synced the same JIT way a human's is, once `syncUser`'s current requirement (present `sub`, `email`, `name`) is satisfied for a token type that doesn't carry those by default. That's a real implementation gap, not a footnote — see Phase 5. It's also what makes the human-vs-agent distinction for Phase 7's approval action mechanically real rather than a trusted flag: checkable from *how* a session authenticated (login vs. client-credentials), not a self-reported column an agent could misrepresent.

**Where this raises the stakes on gaps [docs/security.md](../../security.md) already names** — not new problems, existing ones with a bigger blast radius once agents hold write access:
- **JWT signature verification** — already flagged as the single highest-priority gap. Today a forged token risks impersonating a mostly-read human session; once Phase 5 ships, it risks impersonating a write-capable agent identity instead. Worth closing before Phase 5, not after.
- **No rate limiting anywhere in the stack** — a bug or a leaked agent client secret can hit the pool-claim query or spam actions at machine speed and volume no human session produces.
- **Plaintext `.env` secrets** — agent client secrets are now write-capable machine credentials sitting in the same weak posture as everything else there, invoked programmatically rather than typed by a person.

## Phase plan

**Phase 1 — planner (Scout's successor)**
- 🟡 v1: claim-and-assign, reusing Scout's existing availability heuristic as the first decision rule
- ⚪ Needs real write access to task-service's assignment endpoint via `mcp/` — Scout today is read-only

**Phase 2 — ai-tools/classification, via GoFeeler's LLM integration**
- 🟡 This *is* [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md)'s Phase 5 (real sentiment analysis replacing the naive keyword matcher) — building it as `intelligence/ai-tools/classification` from the start, rather than inline in GoFeeler's service code, is what makes it a reusable tool other agents can call later instead of a one-off.

**Phase 3 — SpringPix + gis-analyst/image-analyst**
- ⚪ Blocked on SpringPix existing — still not yet planned in detail per [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md)
- ⚪ `ai-tools/vision` — the shared capability both agents call into

**Phase 4 — qa-agent as agentic reviewer**
- ⚪ Needs the same `mcp/` write access as planner (approve/reject transitions)
- ⚪ Needs a defined quality bar — same standard as a human reviewer, or a narrower automated-check subset? Not decided.

**Phase 5 — mcp/ buildout**
- 🟡 The actual blocker for every branch above going beyond Scout's current read-only ceiling. Minimum viable: MCP servers for task-service (claim/assign/status-transition) and asset-service (read uploaded content).
- 🟡 **Prerequisite: agent identity via Keycloak service accounts** — each agent as a Keycloak client (client-credentials grant), roles assigned to its service account like a human user. Needs `syncUser` to handle a token type that doesn't carry `email`/`name` by default (protocol mappers, or a relaxed sync requirement for service-account tokens specifically) — real implementation work, not just config. See Agent security model above.
- 🟡 **Permission boundary, resolved and enforced at the tool layer:** whatever server gives `planner` write access must not expose any endpoint touching `accounts`/`projects` contract fields (`payment_terms`, project creation). `planner` assigns within an already-agreed Project; it never creates one or touches its terms. See [docs/business/2.0/intelligence.md](../../business/2.0/intelligence.md)'s "Business decisions stay human" — this is that boundary implemented, not just stated.

**Phase 6 — memory/ + knowledge/**
- ⚪ Try reusing `task_comments` (new internal-only visibility value, as agent scratch notes) before building bespoke storage — cheaper, reuses infrastructure that already exists.
- ⚪ `knowledge/` starts empty. First real candidates: GoFeeler's sentiment vocabulary (already an ES index, could be referenced rather than duplicated) and, later, a library of past reports for report-writer to match tone/format against.

**Phase 7 — agent evaluation & reallocation loop**
- ⚪ Efficiency scoring per agent, reusing [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) Phase 8's event stream (once built) for throughput/turnaround, [docs/business/2.0/intelligence.md](../../business/2.0/intelligence.md)'s per-task compute cost, and `qa-agent`'s own approve/reject history as a quality proxy — not a new measurement system, existing signals repurposed.
- ⚪ Two outputs, neither autonomous: a fine-tune flag (→ `prompts/`/`models/`) and a reallocation flag (→ `planner`'s routing weights). Both are proposals requiring approval from a human `platform:agent-supervisor` before landing — see [docs/business/2.0/intelligence.md](../../business/2.0/intelligence.md)'s "Agent evaluation and accountability" and the Agent security model above for how the human-only check is actually enforced.
- ⚪ Dark-task audit sampling — pulling some percentage of fully-agentic Tasks for human spot-check after completion, so drift gets caught before this loop is deciding off unreviewed data. Rate and mechanism not decided.
- ⚪ `agent-supervisor` needs adding as a new `intelligence/agents/` subfolder — not one of the original six. See the mapping table above.

## Open questions

- **Resolved, worth restating here:** individual Task execution stays fully agentic (`planner` → analyst-role agent → `qa-agent` → `report-writer`, no human required) — but the eval/reallocation loop that watches those agents over time (Phase 7) requires human approval before any change lands, and contract/payout/vendor decisions are never delegated to an agent at all, enforced at the `mcp/` tool layer (Phase 5). See [docs/business/2.0/intelligence.md](../../business/2.0/intelligence.md) for the reasoning behind where that line sits.
- **`workflows/` vs. the `workflow` (Camunda) service** — same shape of risk as the earlier `messaging`/`event-bus` collision (see [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s Recently resolved). Working assumption: `intelligence/workflows/` orchestrates steps *inside* a single Task state (research → classify → write, all still "analyst" from Camunda's point of view), while Camunda keeps owning the Task-level state machine. Not yet confirmed.
- **report-writer / research-agent's place in the role model** — see the mapping table above; genuinely unresolved, not just unwritten.
- **Cost/latency budget per agent step** — not discussed here; see [docs/business/2.0/intelligence.md](../../business/2.0/intelligence.md).
