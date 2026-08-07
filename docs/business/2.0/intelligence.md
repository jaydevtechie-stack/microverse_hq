# Microverse — business design 2.0: the agentic workforce

Extends [docs/business/1.0/overview.md](../1.0/overview.md). Distinct from [docs/roadmap/2.0/intelligence.md](../../roadmap/2.0/intelligence.md) (build sequence for `intelligence/`) — this is the business case for agentic participants in the task workflow: what actually changes economically when an Analyst, PM, or Reviewer can be agentic rather than human, and the questions that raises which [docs/business/1.0/overview.md](../1.0/overview.md)'s existing Payouts section didn't anticipate because it was written assuming a person on the other end. Where [docs/architecture/2.0/intelligence.md](../../architecture/2.0/intelligence.md) maps the `intelligence/` folder technically, this is why it matters commercially.

## The core thesis

Microverse's product bet isn't "we added AI features." It's: **any workforce role — project manager, analyst, reviewer — can be filled by a human or a capable agent, using the exact same task workflow, the exact same permissions, the exact same audit trail.** This was true in the role model from the very beginning ([docs/architecture/1.0/core.md](../../architecture/1.0/core.md): *"Agents are simply assigned roles the same way — no separate agent-identity model needed"*) — `intelligence/` is where that promise becomes something actually built, not just an architectural nicety.

This matters commercially in a way "we use AI" doesn't: a customer isn't being sold a chatbot bolted onto a platform. They're being sold a marketplace where the *work itself* can be done by whichever combination of human and agentic talent is fastest, cheapest, or most available — with elixtempo (see [docs/business/1.0/product-strategy.md](../1.0/product-strategy.md)'s product definition) making sure that mix stays trustworthy regardless of who or what actually did the work.

## Selling points, stated plainly

- **One workforce, two kinds of workers, indistinguishable at the permission/audit layer.** A `qa-agent` reviewing work is bound by the exact same approve/reject action, the exact same task-status transition, the exact same audit trail as a human reviewer. Nothing about the system trusts an agent less carefully or more loosely than a human — the trust boundary is the role, not the species doing the role.
- **Centralized AI capability, not six reinvented wheels.** `ai-tools` as one shared, language-agnostic service means GoFeeler (Go), SpringPix (Java), and every future domain-service reach for the *same* classification/vision/OCR capability rather than each service quietly building its own. Consistency and cost efficiency, not a marketing line.
- **Every agent maps to a real operational need**, not a generic "AI assistant." `planner` fills a specific role (PM), `qa-agent` fills a specific role (reviewer) — this is staffing, not a chatbot feature.
- **elixtempo's fairness guarantee extends to agents too.** Payouts (Branch 9) work the same way whether the "analyst" being compensated is Mark or an agentic worker — the trust layer doesn't care which.

## Cost model — human analyst vs. agentic analyst

The direct lever: [docs/business/1.0/overview.md](../1.0/overview.md)'s Payouts section (tracked in [docs/roadmap/1.0/domain-services.md](../../roadmap/1.0/domain-services.md) Branch 9, still undesigned) assumes a human getting paid — hourly via `elixtempo`'s tracked time, or per-task. An agentic analyst has a fundamentally different cost shape: per-task compute/API cost, not a wage. Every Task an agent completes instead of a human changes the margin math on that Task.

| | Human analyst | Agentic analyst |
|---|---|---|
| Cost driver | Hourly rate × `elixtempo` tracked time | Per-task compute cost (`ai-tools` calls, model tokens) |
| Payout mechanism | Branch 9's payout flow (Stripe Connect candidate, still undesigned) | None — an internal compute cost, not a person to pay |
| Turnaround | Bounded by human availability (Scout's current availability heuristic) | Bounded by model latency + `mcp/` round-trips — plausibly much faster, which changes SLA math |
| Quality signal | Kudos + performance history (Djaboard) | Efficiency scoring, not Kudos — see Agent evaluation and accountability below |

A Task completed by an agent never touches Branch 9's payout side at all — it only carries a (likely much smaller) compute cost. The same customer price produces a different margin depending on whether the analyst behind it was human or agentic. Whether that difference gets passed to the customer or kept entirely as margin is the pricing question below, not something to default silently either way.

## Agent evaluation and accountability

**Resolved: agents aren't Kudos-eligible — they're evaluated for efficiency instead**, and that evaluation drives two specific downstream actions:

- **Fine-tuning flag** — routes to `intelligence/prompts/`/`intelligence/models/`. A consistently underperforming agent gets its prompt revised or its model config swapped, versioned the same way everything else in those folders already is.
- **Resource reallocation** — routes to `planner`. A consistently strong agent gets more volume; a struggling one gets throttled until it's retuned. This is `planner` routing on a live efficiency score, not just Scout's availability heuristic.

Signal sources, all reusing infrastructure this project already has rather than inventing new measurement: [docs/roadmap/1.0/domain-services.md](../../roadmap/1.0/domain-services.md) Branch 8's event stream (once built) for throughput/turnaround, per-task compute cost from the Cost model above, and `qa-agent`'s own approve/reject history per agent as a quality proxy — a sharper signal than Kudos ever gave for humans, since it's generated automatically rather than depending on someone remembering to give kudos.

**Resolved: neither downstream action is autonomous.** Both are proposals, not actions — a human has to approve before a fine-tune actually lands in `prompts/`/`models/`, or before a reallocation actually changes `planner`'s routing weights. This is the direct answer to the liability question this section used to leave open: if a `qa-agent` approves a `gis-analyst`'s work with no human touching the Task, who's accountable? Nobody, because that gap doesn't get allowed to exist unsupervised — not at the individual-Task level (that stays fully agentic, that's the throughput win), but at the level of *decisions that compound across every future Task an agent touches*. A bad Task-level rejection affects one Task; a bad reallocation or a bad retune affects everything that agent does afterward. That's the level that needs the human gate.

**Resolved: a new `platform:agent-supervisor` role, distinct from PM.** Cleaner separation of concerns than overloading the existing PM role — agent oversight isn't the same job as owning an Account's customer relationship, even if the same person ends up holding both.

**Resolved: human-or-agentic in general, human-only for the approval action specifically.** The role itself follows the existing Analyst/PM/Reviewer pattern — assignable to a human or an agentic supervisor, no new identity model needed. An agentic supervisor can do the day-to-day watching (surfacing efficiency scores, drafting the fine-tune/reallocation proposal itself). But *approving* a Phase 7 proposal is scoped narrower than the role: that one action requires the assignee to be human. This mirrors [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s own precedent for a structurally identical problem — conflict-of-interest checks aren't enforced by the role model at all, they're deferred to an assignment-time check on the specific action, not a role-level rule. Same shape here.

**Resolved: the human-vs-agent check is mechanically real, not a trusted flag.** Every agent authenticates to Keycloak as a service account via the client-credentials grant, distinct from a human's login (authorization code flow). Whether a given session is human or agentic is checkable from *how it authenticated*, not from a self-reported column an agent could misrepresent. The approval action's human-only check reads this signal directly — see [docs/roadmap/2.0/intelligence.md](../../roadmap/2.0/intelligence.md)'s Agent security model.

**Also still open: dark-task audit sampling.** A "dark task" — planner assigns, an analyst-role agent works it, `qa-agent` reviews, `report-writer` delivers, no human touches it — stays allowed at the individual-Task level per the resolution above. Whether some percentage of dark Tasks should get pulled for human spot-check after the fact, so drift gets caught before the eval loop above is making decisions off data nobody's actually looked at, is a real question but not a resolved one. Which price tiers even allow dark Tasks in the first place also isn't decided — see Still open below.

## Business decisions stay human

**Resolved, full stop, not a role question:** contract terms, payout mechanics, and vendor/model-provider relationships are never delegated to an agent, regardless of who ends up approving agent fine-tuning above. This is a different and stricter boundary than the accountability gate — that one is about who signs off on operational changes to an agent; this one is about a category of decision no agent proposes or executes in the first place.

Concretely, all already living in [docs/business/1.0/overview.md](../1.0/overview.md):
- **Project/contract terms** — `payment_terms`, whether work starts before payment clears, renegotiation. A Project *is* the contract unit; no agent decides what goes into that field.
- **Payout mechanism** — the Stripe Connect question, payout basis, timing dependency. Microverse contracting with a payment processor, and indirectly with every PM/analyst it pays, is inherently human.
- **Vendor/model-provider relationships** — API agreements and data-handling terms with whoever provides the models behind `intelligence/models/` are the same category of decision, just pointed outward instead of at customers.

**This is a tool-layer boundary, not just a policy note** — see [docs/roadmap/2.0/intelligence.md](../../roadmap/2.0/intelligence.md)'s Phase 5: whatever MCP server gives `planner` (or any future write-capable agent) write access should never expose an endpoint touching `accounts`/`projects` contract fields. `planner` can assign within an already-agreed Project; it should not be able to create one or touch its terms, enforced by what the tool exposes, not by instruction alone.

## Still open

- **Pricing.** [docs/business/1.0/overview.md](../1.0/overview.md) leaves this "not yet discussed" generally — here it's sharper: do customers get told or charged differently for agent-completed work, or is it invisible (same price, same SLA promise, different backend margin)? This decides whether "agentic analyst" is a sellable feature or purely an internal efficiency lever nobody outside Microverse needs to know about.
- **SLA implications.** If agentic analysts genuinely turn work around faster than the human-availability baseline, does that change the SLA glossary term [docs/business/1.0/overview.md](../1.0/overview.md) already defines? A faster *guaranteed* turnaround is itself a plausible premium tier, not just an operational nicety.
- **Upsell framing.** [docs/business/1.0/overview.md](../1.0/overview.md)'s Account management section already treats "an Account adding a second service" as the natural Upsell case. Is "upgrade this Account's GoFeeler work to agentic analysts" itself a sellable upsell — faster turnaround as a paid tier — or purely internal, with no customer-facing product at all? Not decided either way.
- **Per-Account opt-in.** Does an Account get a say in whether its work is handled by a human or agentic analyst, or is that entirely a Microverse-internal routing decision or invisible from the outside? Ties directly into the pricing and upsell questions above, and to dark-task audit sampling above.
- **Agent failure/escalation.** When `qa-agent` or `planner` genuinely can't make a confident call, what's the equivalent of a human reviewer saying "I need to ask someone"? Not yet designed.

## Glossary additions

Extends [docs/business/1.0/overview.md](../1.0/overview.md)'s glossary — same format, same intent.

| Term | Plain English | In Microverse |
|---|---|---|
| **Agentic analyst** | An AI system filling the Analyst role | Any `intelligence/agents/` occupant assigned `platform:analyst` + a service scope — `gis-analyst`/`image-analyst` are the first realistic candidates, gated on SpringPix existing |
| **Agentic PM** | An AI system filling the Project Manager role | `intelligence/agents/planner` — the natural successor to Scout, which today only recommends rather than assigns |
| **Agentic reviewer** | An AI system filling the Reviewer role | `intelligence/agents/qa-agent` — slots into the existing `analyst → reviewer` transition with no new workflow state |
| **Agentic supervisor** | An AI system filling the new Agent Supervisor role | `platform:agent-supervisor` — watches agent efficiency and drafts fine-tune/reallocation proposals; the *approval* of a proposal specifically requires a human assignee regardless of who fills the role generally |
| **Compute cost** | The agentic-analyst equivalent of a payout | Per-task `ai-tools`/model cost — never runs through Branch 9's payout flow, since there's no person to pay |
| **Dark task** | A Task completed with no human touching it at all | `planner` assigns → an agentic analyst works it → `qa-agent` reviews → `report-writer` delivers. Allowed at the individual-Task level; audit sampling and which price tiers permit it are still open, see Agent evaluation and accountability |
