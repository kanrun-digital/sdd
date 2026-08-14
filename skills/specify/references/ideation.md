# Ideation orchestration — specify step 3 (depth-gated named subagents)

For a feature that is a real bet, the deep-dive answers are not enough to commit to an approach. This pass grounds the committed approach in **§1 ¶3** of the spec. It is **read-only research + named subagents + user confirms**. Nothing is written until the spec is. Everything stays at **product level**: no concrete datastore / broker / framework / library names (those are `design` decisions). Every subagent is told the same.

The **interview-depth dial** ([`../../_shared/interview-depth.md`](../../_shared/interview-depth.md)) governs what runs. Feature **size** is a secondary trimmer. The analyses that used to run inline are now **named-subagent dispatches**. Each runs with a clean, isolated context (the value is fresh eyes). Spawn each with `subagent_type: "sdd:<name>"` per [`../../_shared/agent-roster.md`](../../_shared/agent-roster.md) §Dispatching. Use a `general-purpose` fallback if the namespaced agent is not available.

## When each agent runs (depth × size)

| Depth | What runs |
|---|---|
| **easy** | **Skip the suite.** No subagents — the step-2 deep-dive answers are enough. §1 ¶3 still names a committed approach. Claude picks it from the deep-dive and records it as an **assumption in the easy ledger** (per the depth dial) for the user to veto. No research. No 3-approach fan-out. |
| **medium** (default) | `researcher` (competitive / web) **+** `devils-advocate` (failure modes). No strategist/analyst/RICE — a lighter grounding. |
| **hard** | **Full suite:** `researcher` **+** `strategist` (3 approaches) **+** `analyst` (multi-perspective over those approaches) **+** `devils-advocate`, then the Claude-proposed **RICE + feasibility** confirm. |

**Size is the secondary signal**, never the primary gate. The user's chosen depth wins. Size only *trims volume* within it. An XS/S feature at hard still runs the suite. But the `researcher` table may legitimately be one `N/A — internal tool` row, and the RICE pass stays terse. (Pre-1.7 this pass was gated by size alone — "M/L/XL only". Depth is now the gate. Size is the trimmer.)

## The dispatches

The dispatching prompt is the **only channel** to a clean-context agent (per the shared agent contract). For every agent below, the prompt inlines the **captured idea (verbatim baseline)** + the **step-2 deep-dive answers** + (if it exists) the **`CONTEXT.md` path** for canonical terms. The spec is not written yet. There is no `spec.md` to read. The material is therefore inlined.

1. **`researcher`** (`sdd:researcher`) — *medium + hard.* Competitive + adjacent-solution research with web access. Returns a cited table across the **8-axis competitor grid** (lifted from `vibe-competitor-market-research`): **Positioning · Offer · Funnel · Messaging · SEO · Ads · Product · Trust** — not just Features/Gap. Each row carries the product + URL + the axis finding + a `Value 1–5` signal + the `Gap`. Each row is footnoted with date + query.

   **The table schema (one row per product×axis finding, not per product):**
   ```
   | Product | URL | Axis (of the 8) | Finding | Value 1–5 | Gap | Evidence |
   ```
   **`Evidence`** is one of the **5 provenance labels** (from `kanrun-artifact-contracts.md`): `USER_CONFIRMED` · `RESEARCH_CONFIRMED` · `PRIOR_ARTIFACT` · `ASSUMPTION` · `NEEDS_PROOF`. Default new web-sourced rows to `RESEARCH_CONFIRMED`. A row the user dictated in the interview → `USER_CONFIRMED`. An inference the researcher draws without a source → `ASSUMPTION` (and it migrates to §10 Assumptions). Rows tagged `NEEDS_PROOF` are draft-only. They must not seed a §1 ¶3 claim without a follow-up.

   **Plus a closing `## Do Not Copy` block** (lifted from `vibe-competitor-market-research`): 1–4 sharp competitor patterns the feature should deliberately avoid. Each becomes a candidate §3 Non-goal. The researcher also returns a one-line synthesis of the biggest gap.

   **Fallback:** a `general-purpose` Agent given the same prompt and `WebSearch`/`WebFetch`. **If web access is unavailable** in this run, accept its `RESEARCH_LIMITED` output. Carry the gap as a noted gap (like the `mmdc` fallback elsewhere). Never invent competitors or `RESEARCH_CONFIRMED` rows to fill the table. Unsourced findings stay `ASSUMPTION`.
2. **`strategist`** (`sdd:strategist`) — *hard only.* Generates the three strategic approaches — A Simplicity / B Differentiation / C Balanced — each with Name · Thesis · For-whom · Outcome-metric · Key-trade-off · Effort-signal. Dispatch it **together with `researcher`** in one message. They are independent.
3. **`analyst`** (`sdd:analyst`) — *hard only.* Multi-perspective review (Engineer / Executive / UX lenses) **of `strategist`'s three approaches** → a 3×3 synthesis matrix (+/0/−, ≤6-word justifications) + one synthesis line per approach. Dispatch it **after** `strategist` returns (it needs the three approaches inlined). The Engineer lens stays abstract — no product/library names.
4. **`devils-advocate`** (`sdd:devils-advocate`) — *medium + hard.* Run it in its **failure-mode mode** (not the clarify ambiguity mode): the prompt asks «there is no spec yet — here is the idea (+ approaches, at hard); find how this fails — 5–10 attack vectors with production signals: what breaks, how it shows up in monitoring / churn / an incident». Returns the cited vectors. It runs in parallel with the others. At hard, pass it the approaches so it attacks the leading one. **Fallback:** `general-purpose` with the same prompt.

> Ordering at hard: dispatch `researcher` + `strategist` + `devils-advocate` in one message. Once `strategist` returns, dispatch `analyst` over its three approaches. At medium: dispatch `researcher` + `devils-advocate` together.

## RICE + feasibility (hard only — Claude-proposed, `AskUserQuestion` confirm)

These stay **inline** (computed from the upstream signals + confirmed with the user — not a subagent):

5. **Claude-proposed RICE.** Compute from upstream: Reach ← user segments. Impact ← problem severity + `analyst`'s Executive lens. Confidence ← inverse of unresolved TBDs. Effort ← the approaches' effort signal. Compute `R × I × C / E`. Confirm each number with the user (`Confirm` / `Adjust up` / `Adjust down` / `Mark TBD`). Never make the user invent the numbers (the «calculator game» anti-pattern). Phrase per [`../../_shared/ask-style.md`](../../_shared/ask-style.md).
6. **Feasibility (read-only repo scan + confirm).** Scan the repo for adjacent shipped features. Propose three checkboxes — Tech / Skills / Time — each justified by a cited adjacent feature. Confirm each (`Confirm ☑` / `Flip to ☐ — reason` / `TBD`).

## Recommendation → §1 ¶3

Claude picks one approach and writes a 3–5 sentence rationale, then confirms it with the user (`Accept` / `Pick different` / `Mark TBD`). The accepted approach becomes **§1 ¶3** of the spec. What the rationale must cite depends on what ran:

- **hard** — cite all four upstream signals: the RICE score, the feasibility state, ≥1 `analyst` synthesis-matrix cell, and ≥1 `researcher` competitive gap.
- **medium** — cite the `researcher` gap + `devils-advocate`'s sharpest vector + the deep-dive's success criterion (no RICE/matrix exist to cite). It is still a real, confirmed recommendation — just lighter.
- **easy** — §1 ¶3 states the approach Claude inferred from the deep-dive, surfaced in the assumptions ledger. The user's veto/accept on the ledger *is* the confirm.

### Evidence labeling on §1 ¶3 (medium/hard only — easy skips, over-production)

At medium and hard depth, every claim in the §1 ¶3 rationale carries a tag (lifted from `vibe-market-radar`'s evidence discipline, combined with the `researcher` provenance labels above):

- **`Fact`** — a verifiable statement with a cited source (a `RESEARCH_CONFIRMED` row, an `USER_CONFIRMED` interview answer, a `PRIOR_ARTIFACT` from a memory file). Inline as: `<claim> [Fact: <source>]`.
- **`Interpretation`** — the skill's reasoned read of the facts (e.g. the recommendation itself, the RICE-weighted pick). Inline as: `<claim> [Interpretation]`.
- **`Hypothesis`** — an unverified bet that would change the pick if false. Inline as: `<claim> [Hypothesis]` AND mirror it to §10 Assumptions with `source: assumption`.

A §1 ¶3 with no `[Fact: ...]` tag at medium/hard depth is a critic F7 smell. The recommendation floats free of evidence. At easy depth, skip tagging (the ledger is the evidence trail).

## How the outputs feed the spec

- **`researcher` gap** → cited in the §1 ¶3 recommendation as a `[Fact: <row>]`. A competitor's deliberate omission may seed a §3 Non-goal. A `## Do Not Copy` finding seeds §3 directly. Rows tagged `ASSUMPTION`/`NEEDS_PROOF` migrate to §10 Assumptions (with matching `source`/`confidence`).
- **`strategist` approaches** → the option set the recommendation chooses from (and the runners-up seed §8 Open questions if the user wants them tracked).
- **`analyst` matrix** → cited in §1 ¶3. A consistently `−` lens flags a §6 NFR or **§9 Risk** to watch.
- **`devils-advocate` vectors** → the sharpest one is reserved for §6.1 Security/privacy + abuse cases (the *security* angle) AND mirrored as a **§9 Risk** row (the *product* angle — same vector, two audiences). The rest seed §8 Open questions.
- **RICE / feasibility** → cited in §1 ¶3. The RICE score also feeds the roadmap's Next-ordering when `specify` registers the feature.
- **Easy-depth assumptions ledger** → persists as **§10 Assumptions** rows (no longer a transient runtime artifact).

## Discipline

- **Depth is the gate.** easy skips the suite (ledger-an-assumption instead). medium = research + adversary. hard = the full SLDC-style pass. The dial keeps easy/medium light after the agent re-expansion.
- **Three approaches, not one** (at hard depth). One approach means the decision is already taken — nothing to evaluate. **All three perspectives** (at hard depth). Engineer-only is blind to business/UX. Executive-only is blind to cost.
- **The adversary runs from clean context** — otherwise it inherits the upstream optimism.
- **Product-level only** — no concrete stack in any analysis or in §1 ¶3. Tech belongs to `design`.
- **Never invent** competitors or RICE numbers to fill the pass. An honest `N/A — internal tool` row or a `Mark TBD` beats fabricated research. An unsourced finding is `ASSUMPTION`, never `RESEARCH_CONFIRMED`.
- **Evidence labels are honest, not decorative.** `RESEARCH_CONFIRMED` requires a URL+date. `USER_CONFIRMED` requires a verbatim interview quote. `PRIOR_ARTIFACT` requires a named file path. A label without its evidence is `ASSUMPTION` (and lands in §10).
- **Planning-mode-friendly:** the whole pass is read-only. If the skill started in plan mode, keep everything in session memory and let the spec write happen after `ExitPlanMode`.
