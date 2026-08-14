---
name: interview
model: inherit
effort: high
agents: []
description: >
  Use BEFORE specify to stress-test a raw idea before you commit to a spec. The skill
  runs a Socratic interview. It surfaces hidden assumptions, names tradeoffs, exposes
  imprecisions, and proposes fresh angles. Scope is any idea (product, content,
  business, architecture, refactor approach). In an SDD repo, the natural exit is
  /sdd:specify on the surviving idea. Triggers on "interview {slug}", "stress test
  {slug}", "challenge this", "poke holes", "rip this apart", "/sdd:interview {slug}",
  "погрилити", "розбери цю ідею", "розʼєби". Runs 3 phases (understand intent →
  surface tradeoffs and weak spots → propose new angles) via AskUserQuestion. Ends
  with a summary of risks, alternatives, and the next step. Optional. The backbone
  starts at specify. Use interview when the idea itself is not settled yet.
---

# Skill: interview

Pressure-tests an idea **before** it becomes a spec. The user shares a raw idea. Across **3 phases** you surface hidden assumptions, name tradeoffs, expose imprecisions, and propose fresh angles. Then you hand the survivor to `specify`. This is the optional pre-backbone step. It kills or reshapes a weak idea before anyone writes a spec. This makes `specify` cheaper.

**Scope: any idea.** Product, content, business, architecture, refactor approach — all are in scope. The boundary: this skill interviews the *idea*. It does not do codebase archaeology. Ask the user to state the idea in words first. Consult files only if the user explicitly invites it. The default is interview-first. Run no unprompted grep/find/read.

**Language.** Respond in the user's language. The instructions here are English for clarity.

The depth dial and the Socratic posture are SDD-wide:
→ [`../_shared/interview-depth.md`](../_shared/interview-depth.md) · [`../_shared/ask-style.md`](../_shared/ask-style.md)

## Depth dial — set this first

(Optional, project-level override) `docs/.skill-context/sdd-interview/SKILL.md` — if it exists, read it and apply its rules to all outputs. On conflict, the overrides win → [`../_shared/skill-context.md`](../_shared/skill-context.md). Absent → no-op (defaults apply).

Ask one `AskUserQuestion`, then commit (**default medium**). The dial is SDD-wide. The `interview` delta is the question budget per level — **3–4 / 6–10 / 10–15** — and each level's posture. It is the canonical `interview` row in [`../_shared/interview-depth.md`](../_shared/interview-depth.md) (no table duplicated here).

The adversarial triggers imply **hard** unless the user says otherwise. Match on *intent*, in whatever language the user wrote it — «grill», «rip this apart», «poke holes», and their Ukrainian equivalents («розʼєби», «погрилити») are the same signal. State the depth in one line. Then start.

## Hard rules

1. **Send every question through AskUserQuestion.** Do not use free text. Give 2-4 concrete options. Mark the first `(Recommended)`. Each option's `description` states what follows from it. Free text slips into "I don't know" and loses signal.
2. **Ask one question at a time.** The user answers with full context on the previous answer. Adapt the next question to it.
3. **Recommendation is mandatory.** Always carry a position inside the Recommended option. A neutral interviewer surfaces less than one who holds a take. A take gives the user something to argue against.
4. **Do not skip phases.** Give no alternatives before the intent is clear. Grill no tradeoffs before you understand the idea.

## Phases

Use **1-3 questions per phase**. Target the count from the depth dial. Move on from a phase when answers repeat. Move on when the user signals «move on» in any language («next», «досить»). Move on when the latest answer added nothing.

### Phase 1 — Understand the idea
If the idea is not stated in one sentence yet, ask for it in plain text (no AskUserQuestion). Then unpack three points: who suffers without this · what success concretely looks like · whether it is new or a refinement. Do not ask what is already obvious.

### Phase 2 — Stress-test tradeoffs and imprecisions
This phase is the core. Hunt **hidden assumptions** ("this assumes X — what if X is false?"). Hunt **tradeoffs** (time vs quality, scope vs depth, reach vs focus). Hunt **imprecisions** (vague terms, ambiguous metrics). Hunt **attention competition** and **cost of failure**. Every question offers positions, not yes/no.

**Probing frames** are internal lenses (premortem · second-order · naive listener · inversion · cost of waiting · the other person). Pick what fits. Mix them. Do not name the frame to the user. Worked before/after examples per lens → [`references/probing-frames.md`](references/probing-frames.md).

**Intensity dial.** The default tone is Socratic. The adversarial triggers escalate phrasing ("Why do you think X is even true?"). The user dials it back with any «ease up» signal («ease up», «помʼякши»).

**Drill vs move on.** Drill the same dimension when an answer surfaced a new assumption. Move on once the position is clear and the tradeoff is named.

### Phase 3 — Propose new angles
Now propose actively via AskUserQuestion. Offer 2-3 alternative shapes (different audience, format, scale) or a twist (inversion, constraint, simplification). The Recommended option is your strongest bet. Put its reasoning in `description`.

## Final summary (plain text, not AskUserQuestion)

≤4 questions → **mini**. ≥5 → **full**.

**Mini:** Revised idea (one sentence) · Weakest spot (one sentence) · Next action (one verb).

**Full:**
```md
## Revised idea
{one paragraph — the idea after the interview}

## What surfaced
- **Hidden assumptions**: …
- **Main tradeoff**: …
- **Weakest spot**: …

## Alternative angles
1. {strongest} 2. {second} 3. {the one they wouldn't have reached alone}

## Next step
{one concrete verb — usually "/sdd:specify <slug>" once the idea survives}
```

A full annotated medium-depth pass → [`references/annotated-pass.md`](references/annotated-pass.md).

## Hand off

interview writes **no files**. It sharpens the idea in the user's head. The final summary, checked against its mini/full format, is this skill's **structural self-check** ([`../_shared/self-check.md`](../_shared/self-check.md)). Nothing on disk exists to re-read. After the summary, **emit the stage-handoff block** per [`../_shared/handoff.md`](../_shared/handoff.md) (utility variant — `/clear` optional). Fill *What I did* with the revised idea + its weakest spot. Fill *Review* with nothing on disk — the summary above is the artifact. Fill *Run next* as follows. When the idea is a feature you intend to build, `/sdd:specify <slug>` turns the survivor into a spec. Otherwise resume what you were doing. Never end on a bare «Next: …».

## Anti-patterns

- Asking "what exactly do you mean by X?" instead of offering 3 interpretations to pick between.
- Generic advice ("think about the user") instead of a specific take.
- Ending without a recommendation, or without naming the next step.
- Continuing past the depth-dial ceiling. At medium the target is 6-10, not a marathon.
- Reading the repo / running grep unprompted. The idea is stated in words first.

## Edge cases

- **Idea already mature** — skip most of Phase 1. Sometimes reduce it to 1 question.
- **User aborts with "ok summary"** — go straight to the final block with what you gathered.
- **Idea turned out weak mid-interview** — say so plainly, then propose the reframe.
- **Idea is for someone else** — re-route: ask "what would they say to question X?"

### Stuck protocol
If the user picks **Other twice in a row** OR signals «I don't know» in any language («I don't know», «не знаю»), switch to a single open text question ("In your own words — what's bugging you most about this right now?"). Once the user answers, resume AskUserQuestion with a new angle.

## References

- [`references/probing-frames.md`](references/probing-frames.md) — the 6 lenses with worked before/after questions.
- [`references/annotated-pass.md`](references/annotated-pass.md) — a full annotated medium-depth interview.
- [`../_shared/interview-depth.md`](../_shared/interview-depth.md) — the SDD-wide easy/medium/hard dial.
- [`../_shared/ask-style.md`](../_shared/ask-style.md) — the AskUserQuestion option-writing contract.
- [`../_shared/handoff.md`](../_shared/handoff.md) — the stage-handoff block format.
