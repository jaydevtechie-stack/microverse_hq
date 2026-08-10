# Microverse — architecture 2.0: the intelligence layer

Extends [docs/architecture/1.0/core.md](../1.0/core.md) — same "living record" spirit, focused on the `intelligence/` folder now that its real shape is defined. Resolves the "intelligence/ folder taxonomy" open question sitting in the 1.0 doc.

## Philosophy

`intelligence/` isn't a bolted-on AI features folder — it's where the project's original founding idea finally gets a concrete home: *"a human or agentic project manager assigns the task to a human or agentic task analyst."* Every folder here exists to make some role in that sentence real.

## The folder, resolved

```
intelligence/
├── agents/           — runnable services, each an agentic worker
├── ai-tools/          — ONE runnable service, shared AI capabilities
├── mcp/               — runnable, once multiple agents share tools
├── knowledge/         — data layer (reuses Elasticsearch, not a new vector DB)
├── memory/            — data layer (reuses Redis, previously unused infra)
├── models/            — config/metadata only, no runtime component
├── prompts/           — version-controlled text, no runtime component
└── workflows/         — DAG definitions, executed by an orchestrator
```

**Runnable services:** `agents/*`, `ai-tools`, `mcp`.
**Config/data layers, not independently runnable:** `knowledge`, `memory`, `models`, `prompts`, `workflows`.

## Agents — mapped to existing Microverse roles

| Agent | Maps to | Notes |
|---|---|---|
| `planner` | The agentic **Project Manager** | Ties directly to the founding vision — a PM role that can be filled by an agent, same `platform:project-manager` role, same task pool, same permissions as a human PM. |
| `qa-agent` | The agentic **Reviewer** | Fills `platform:reviewer` the same way — checks analyst work quality automatically, same approve/reject action a human reviewer takes. |
| `gis-analyst` | The agentic **Analyst for SpringPix** | Does the raster/GIS hotspot reasoning — the actual analysis engine behind SpringPix's "Analyse" step, same shape as GoFeeler's planned LLM upgrade (Branch 5). |
| `image-analyst` | The agentic **Analyst for PyReel** / general vision | Broader than `gis-analyst`'s geo-specific reasoning — general image/video understanding. |
| `report-writer` | Feeds **Djaboard / the Reports nav placeholder** | Writes up findings (GIS results, sentiment patterns) into human-readable reports for customers or PMs — not raw data, a written narrative. |
| `research-agent` | Context-gathering for ambiguous tasks | Open-ended synthesis when a task doesn't map cleanly to a fixed classification — could also back Scout 2.0's `read_task_content` tool. |

**Design rule carried over from the Scout discussion:** every agent stays a *recommender*, never an auto-actor, for anything consequential — `planner` proposes an assignment, a human can still override; `qa-agent` flags concerns, doesn't unilaterally reject without visibility. Same "human in the loop" principle regardless of which role the agent is filling.

## ai-tools — one shared service, not six

Classification, embeddings, extraction, OCR, summarization, vision — these are **reusable capabilities**, not full agents. The critical design decision: **this is one service exposing an API, not a Python library each agent imports.** Reason: Microverse is genuinely polyglot (GoFeeler is Go, SpringPix is Java, agents are Python) — a Python library isn't callable from Go or Java, but an API-exposed service is callable from anywhere. `ai-tools` is the shared capability layer every domain-service and agent calls into, regardless of what language it's written in.

GoFeeler's Branch 5 `advanced` engine ([docs/architecture/1.0/domain-services.md](../1.0/domain-services.md)) doesn't call `ai-tools` yet — it's GoFeeler-local, calling an LLM provider directly through its own `Provider` interface, since it's the first consumer and `ai-tools` doesn't exist. That interface is the deliberate plug-in point: once `ai-tools` exists, it's a new `Provider` implementation, not a rewrite.

| Tool | Used by |
|---|---|
| `classification` | GoFeeler's Branch 5 sentiment upgrade (once migrated off its direct-provider shim, above) |
| `embeddings` | Semantic task-similarity (Scout 2.0's `get_task_history`), potential search-service enhancement beyond fuzzy/prefix matching |
| `extraction` | Pulling structured entities/dates out of GoFeeler's uploaded chat/email exports before analysis |
| `ocr` | Text extraction from scanned documents or images in asset-service uploads |
| `summarization` | Condensing long content before analysis, or for Reports/dashboard views |
| `vision` | Backs `image-analyst` and `gis-analyst` at a lower level — the raw sight, not the reasoning |

## knowledge / memory — reusing existing infrastructure, not new stores

- **`knowledge`** (long-term, static domain knowledge agents retrieve from) — reuses Elasticsearch's vector search via `search-service`, rather than standing up a separate vector database. Same "don't reinvent the wheel" reasoning as everywhere else in this stack.
- **`memory`** (session/conversation-scoped state) — reuses **Redis**, which has sat in the infrastructure list since early on with no real purpose yet. This finally gives it one.

## models / prompts — config only

Both are artifacts other services consume, not services themselves: `models` holds which LLM/embedding model version is in use per capability; `prompts` holds version-controlled, dev-curated prompt text (Scout 2.0's reasoning prompt, agent system prompts, etc.). Neither has a runtime component of its own. **Not the same thing as GoFeeler's `sentiment_prompt_templates`** ([docs/schema.md](../../schema.md)) — that's a runtime Postgres table, analyst-authored and edited through the UI, scoped to GoFeeler specifically. Same "prompt" word, different audience (developer vs. analyst) and different mechanism (git-versioned file vs. DB row).

## workflows — a real naming collision worth being careful about

`intelligence/workflows` (DAG definitions chaining multiple *agents* together — e.g. `research-agent` → `gis-analyst` → `report-writer` for a complex SpringPix engagement) is **not the same thing** as the `workflow` business-service (Camunda), which orchestrates the *Order → Task → paid → closed* state machine. Same word, genuinely different concern — one orchestrates AI reasoning chains, the other orchestrates the business process. Worth flagging explicitly so this doesn't get conflated later.

## mcp — deferred until it's actually needed

Per the Scout 2.0 proposal in [docs/roadmap/2.0/intelligence.md](../../roadmap/2.0/intelligence.md): not needed for one agent with a handful of tools. Becomes the right answer once a *second* agent wants to share tools `ai-tools` or another agent already exposes — a "know it's the answer when the time comes," not a build-now item.
