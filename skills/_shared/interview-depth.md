# Interview depth — easy / medium / hard (the depth dial)

> **Reference-only.** Not a skill. The Q&A skills (`specify`, `clarify`, `design`, `interview`) read
> this file. It gives the canonical three levels and the adaptation of each. The dial tunes **how much
> the skill decides on its own vs. interrogates you**. It covers question volume, autonomy, which
> analyses run, and the diagram confirmation mode. The modes are confirm per item or write plus
> summarize. It does **not** tune *completeness*. Every acceptance criterion is still covered at every
> level (see the coverage floor below).

## TL;DR (українською)

«Депт-діал» — один регулятор на запуск скіла: **easy / medium / hard**.

- **easy** — скіл сам ухвалює більшість рішень із розумними дефолтами, питає тільки незворотні / високоризикові, і **виписує припущення, які зробив**, щоб ти міг їх ветувати. Менше аналізу, діаграми пишуться + один підсумок (без поштучного питання).
- **medium** — поточний збалансований сократичний прохід (дефолт).
- **hard** — проходимо **кожне** рішення; кожне `AskUserQuestion` виводить trade-off на передній план; повний набір ідейних аналізів (research / approaches / perspectives / devil's-advocate); кожна діаграма підтверджується прозою; edge-cases копаємо глибше.

Повнота (покриття кожного AC) **не залежить** від рівня — easy теж покриває всі AC, просто менше питає *як саме*.

---

## How the level is chosen (every consuming skill, step 1)

A consuming skill resolves the level once, at the top of its run. It applies this precedence. The highest wins:

1. **A `--depth=easy|medium|hard` argument** passed on the invocation, if present. Apply it silently. Ask no question.
2. **The opening `AskUserQuestion`** — ONE depth-selection question, phrased per [`ask-style.md`](./ask-style.md) (explanatory + every term glossed). Its **default option** (the «(Recommended)» first option) is:
   - the `interview_depth` value from `.claude/sdd.local.md` if that file exists and sets it, else
   - **medium**.
   The user can always override the level per run. The saved default only pre-selects the recommendation. It never skips the question (unless `--depth=` was passed).

`interview_depth` is a **plugin-wide** setting. It is documented with the rest in [`../implement/references/settings.md`](../implement/references/settings.md). It is not implement-only. The settings file is **auto-created with documented defaults the first time a skill needs it**. This normally happens in `specify` at the start of the backbone. Later Q&A skills then read a real file. A reader that still finds the file missing defaults the question to medium. There is **no hard dependency** on `implement` having run first. The auto-create is the same documented template wherever it fires.

The opening question is also where the skill states what the level will *do* to this run («easy → I decide the reversible calls myself and list my assumptions. hard → I walk every decision and run the full analysis suite»). The user then picks with eyes open.

## What each level governs (the four axes)

| Axis | **easy** | **medium** (default) | **hard** |
|---|---|---|---|
| **Question volume + autonomy** | Skill decides the reversible / low-stakes calls itself with sensible defaults. It asks ONLY the irreversible / high-blast-radius / genuinely-un-inferable calls. It **states every assumption it made** (an assumptions ledger). The user can veto each one. | The balanced Socratic walk. One `AskUserQuestion` per real decision. Trivial convention-defaults are bundled. | Walks **every** decision. Each question **foregrounds the trade-off** (what you gain / lose / the hidden catch). It probes edge cases harder. |
| **Ideation analyses** (`specify` step 3) | Skip the suite. Use deep-dive answers only. | `researcher` (competitive/web) + `devils-advocate`. | Full suite: `researcher` + `strategist` (3 approaches) + `analyst` (multi-perspective) + `devils-advocate`. Then confirm the Claude-proposed RICE/feasibility result. |
| **Diagram confirmation** (`design` C4, `sequences` flows) | Write the diagram + a **one-line prose summary**, then proceed. No per-diagram question (per [`diagram-presentation.md`](./diagram-presentation.md)). | Prose description + `AskUserQuestion` confirm **per diagram**. | Same as medium — prose description + confirm per diagram (never raw Mermaid). |
| **Edge-case / ambiguity probing** | Only the edges that change the blast radius. | The spec's stated error/authz/edge criteria. | Adversarial. Search for unstated edges. Run the full `devils-advocate` pass. Examine every «what if». |

Read the axes together, not in isolation. **easy** means «trust the defaults, show me what you assumed». **medium** means «walk the real decisions with me». **hard** means «interrogate me, run everything, leave nothing un-probed». The dial scales *effort spent asking*. It does not scale *effort spent being correct*.

## The assumptions ledger (easy only)

At `easy`, the skill makes some decisions **for** the user instead of asking. Record each one as a one-line ledger entry. Emit all entries together before the write-point:

```
- Assumed: <decision> = <chosen value>  — because <default rationale>.  [veto?]
```

The user gets ONE `AskUserQuestion`. It vetoes or adjusts the ledger as a batch, or accepts all entries. A vetoed assumption becomes a real question (medium-style) for that one item. This is the easy-level safety net. It gives autonomy without silent commitment. The user sees every default before it is locked, just not as N separate prompts. (At medium/hard there is no ledger. Those levels asked the question directly.)

## The coverage floor is depth-independent (correctness, not a preference)

Depth tunes **how many questions** and **how much autonomy**. It never tunes **what gets covered**. The completeness guarantees hold at **every** level:

- Every spec §4 user story has ≥1 acceptance criterion (the **use-case floor**). §5 keeps ≥1 AC of each of the 5 coverage types (`specify`).
- Every §4 user story maps to ≥1 flow. Every §5 AC maps to a flow, a branch, or an explicit N/A (`sequences` use-case + AC→flow coverage check).
- Every user story + AC traces end-to-end spec → sequences → data-model → api → tasks → implement (`review`).

`easy` reaches these floors by **deciding** the «how» with defaults. It lists the defaults in the ledger. `hard` reaches them by **asking**. The destination is identical. A skill must never drop an AC, a coverage type, or a flow because the level is `easy`. That error is a correctness bug, not a depth choice. Suppose `easy` cannot infer the «how» for a coverage-relevant decision. Then that decision is one of the «irreversible / un-inferable» ones. The skill **must** ask about it regardless of level.

## Per-skill adaptation (the delta each consuming skill applies)

- **`specify`** — the level gates step 3's ideation suite (table above). It also gates the volume of the step-2 deep-dive and step-7 Socratic validation. The §5 coverage gates are **floor, not dial**. They require ≥1 of each of the 5 AC types **and ≥1 AC per §4 user story** (the use-case floor). They are enforced at every level.
- **`clarify`** — the level gates how aggressively the self-sweep + `devils-advocate` hunt. At easy, they find only build-divergence that changes behavior, with assumptions stated. At hard, they are adversarial and surface every fork. The level also gates the per-finding question volume. Every surfaced ambiguity is still Resolved or Deferred at every level. None stays dangling.
- **`design`** — the level gates the per-section Socratic question volume. At easy, the skill decides convention-defaults itself, keeps a ledger, and asks only blast-radius decisions. At hard, it walks every decision and foregrounds each trade-off. The level also gates the C4 diagram confirmation (per [`diagram-presentation.md`](./diagram-presentation.md)). The blast-radius → ADR gate and the §11 owner+due rule are floors. They are enforced at every level.
- **`interview`** (the pre-spec idea stress-test) — the level maps to a question budget + posture. **easy** → 3–4 questions (decide-for-you: one pass on intent, one sharp tradeoff, one angle). **medium** → 6–10 questions (balanced, full three phases). **hard** → 10–15 questions (interrogate-me: drill every assumption, run more probing frames). It writes no files, so there is no assumptions ledger. The budget and posture are the whole delta.

A consuming skill adds a one-line pointer to this file at its depth-selection step. Otherwise it reads the level as a parameter into its existing loop. It does not re-implement the dial.
