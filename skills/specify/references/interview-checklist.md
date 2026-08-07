# Step-2 interview — must-cover dimensions checklist

The step-2 deep-dive is governed by the depth dial ([`../../_shared/interview-depth.md`](../../_shared/interview-depth.md)) and the shared [`../../_shared/ask-style.md`](../../_shared/ask-style.md) option-writing contract. **This file is the content contract** — the dimensions the interview must surface so the spec template has real input to draft from. The depth dial tunes *volume*, never *coverage intent*: at `easy` the skill infers the un-asked dimensions and records them as a §10 Assumptions row each; at `hard` it walks every dimension with a trade-off foregrounded.

The probing *craft* is borrowed DRY from the sibling interview skill — [`../../interview/references/probing-frames.md`](../../interview/references/probing-frames.md): 6 lenses (premortem · second-order · naive listener · inversion · cost of waiting · the other person). Use the lenses that fit each dimension; mix them; never name a lens to the user. **Fallback if that file is absent:** 3 base lenses — premortem («assume this shipped and failed — what killed it?»), second-order («and then what happens?»), inversion («what would make this *worse*?»).

## The 10 dimensions (in suggested order)

Each row: what to surface, where it lands in the spec, the easy-depth fallback.

| # | Dimension | What you're after | Lands in | Easy-depth fallback |
|---|---|---|---|---|
| 1 | **Problem** | The concrete pain in the user's words — not the solution. One sentence they'd say. | §1 ¶1 | infer from the 1–3-sentence baseline |
| 2 | **Persona / ICP** | Who suffers without this — a named segment, not «user». Their role + situation. | §1 ¶1 persona card + §4 roles | glossary role, `Confidence: low` |
| 3 | **JTBD** | The job this segment hires the feature to do — verb + outcome, not a feature name. | §1 ¶1 persona card | infer, tag `ASSUMPTION` → §10 |
| 4 | **Current-state pain** | How they cope today (manual, spreadsheet, a competitor, nothing). The cost of the status quo. | §1 ¶1 / ¶2 trigger | infer «no good option today» → §10 |
| 5 | **Success metrics** | What concretely changes for the better, observably. Not «better UX» — a movement. | §7 KPIs (numbers) + §2 Goals (shape) | infer one proxy metric, `Confidence: low` |
| 6 | **Constraints** | Tech / regulatory / budget / time / team-capacity ceilings the spec must respect. | §2 (as enablers) / §3 Non-goals (as ceilings) | read `architecture-map.md` if present, else «none stated» → §10 |
| 7 | **Non-goals** | What this feature deliberately will NOT do. The scope fence. | §3 Non-goals (each + a reason) | infer 1–2 from constraints, tag `ASSUMPTION` |
| 8 | **Dependencies** | Upstream systems, prior features, data, teams, or decisions this assumes exist. | §10 Assumptions (each) + §6.1 if security-relevant | infer from `architecture-map.md` / glossary |
| 9 | **Risks** | What could go wrong — product, adoption, market, technical-unknown. With a mitigation if known. | §9 Risks (with mitigation) or §8 OQ (if a decision is needed) | skip (no `devils-advocate` at easy); medium/hard surfaces these via the suite |
| 10 | **Rollout / migration** | How existing users/data get from current → new. Big-bang, phased, feature-flag, dual-write. | §3 Non-goals (if out of scope) or §8 OQ (if undecided) | infer «greenfield, no migration» → §10 |

## Coverage rules

- **No dimension is silently skipped.** At every depth, every dimension is either *asked* (medium/hard), *inferred + recorded as a §10 Assumption* (easy), or *marked N/A with a reason* (e.g. dimension 10 on a greenfield feature → `<!-- N/A: greenfield, no migration -->` in §3).
- **Batch discipline.** Questions go in batches of 2–3 per [`../../_shared/ask-style.md`](../../_shared/ask-style.md). One `AskUserQuestion` per batch; don't fire 10 at once.
- **The dimensions map 1:1 onto spec sections** — a gap in a dimension shows up as a stub in its target section, which the critic (F5/F7/F9) then flags.

## Exit gate (the step-2 → step-3 transition)

Lifted from `vibe-spec-driven-dev`'s spec-mode coaching rule: *«Keep asking: 'What must change, what must not change, and how will we know?' If those three answers are unclear, stay in spec mode.»*

Before leaving step 2 for the ideation suite (step 3), the user must be able to answer all three. They map 1:1 onto the spec:

- **What must change** → §2 Goals (the strategic outcomes)
- **What must not change** → §3 Non-goals (the scope fence)
- **How will we know** → §5 Acceptance criteria + §7 KPIs (observable + measurable)

If, after the deep-dive batches, any of the three is still incoherent, fire **one more mini-batch** of 2–3 questions targeting the unclear answer — do not proceed to the ideation suite on a fuzzy problem framing. (At `easy` depth, infer the missing answer, record it as a §10 Assumption, and let the user veto on the ledger — the gate is softer, not absent.)

## Capture discipline — separate facts, claims, assumptions, decisions

Lifted from `vibe-marketing-control-center`'s interview rule. Every answer the user gives is categorized **in the moment of capture**, not retroactively:

- **Fact** → a verifiable statement (a metric, an existing capability, a date). Drafts into §1 with a `[Fact: <source>]` tag at medium/hard.
- **Claim** → the user's assertion without evidence yet («our users want X»). Drafts into §1 with an evidence label (`USER_CONFIRMED` if they stand behind it, `ASSUMPTION` if inferred); a claim that stays un-evidenced migrates to §10.
- **Assumption** → an input the spec depends on but no one confirmed. Persists as a §10 Assumptions row.
- **Decision** → a committed choice (scope-in, scope-out, metric target). Drafts into §2 Goals or §3 Non-goals.

Mixing these (a «decision» that was actually an unstated assumption) is the classic spec rot — the categorization discipline catches it at capture time.

## Anti-cliché pushback

Lifted from `vibe-marketing-control-center`. When the user answers with a generic quality word — *quality, professional, individual approach, good service, modern, user-friendly, seamless* — do not accept it as a dimension answer. Push back with one question (one `AskUserQuestion` batch, phrased per [`../../_shared/ask-style.md`](../../_shared/ask-style.md)):

> «You said <generic word>. Concretely — what does that change in the customer's life, and why can't a competitor claim the same?»

Land the concrete answer in the relevant dimension (usually JTBD or success metrics); the generic word itself never reaches the spec text.
