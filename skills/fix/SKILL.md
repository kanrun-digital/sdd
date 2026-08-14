---
name: fix
model: inherit
effort: high
agents: [explorer]
description: >
  Use to fix a reported bug spec-first. Reproduce the bug. Trace the symptom to the
  owning feature's acceptance criteria. Pin it with a failing (RED) test. Apply the
  minimal GREEN fix through the same per-task gate implement uses. Then patch the spec
  so the bug class cannot silently return. Triggers on "fix {bug}", "fix the bug in
  {slug}", "bug in {feature}", "/sdd:fix {slug}", "regression in {slug}", "полагодь
  баг", "виправ багу", "регресія в {slug}", "чому зламалось". Triage has three
  outcomes. The AC exists and is violated (regression). The AC is ambiguous (spec-bug
  — patch the wording). No AC covers the bug (gap — add one, marked added-by-fix).
  Works on a repo with no specs at all (soft mode — code-first, recommends survey
  after). Writes a fix record under docs/features/{slug}/_fixes/ and commits with an
  SDD-Fix trailer.
---

# Skill: fix

The **bugfix entry point** — the backbone in miniature, sized for «it's broken», not «build a feature». A bug is **evidence about the spec**, not only about the code. One of three cases holds. An acceptance criterion is violated (the code regressed). The AC was ambiguous enough to permit the behaviour (the spec is the root cause). Nothing covers the behaviour (a gap). The fix always lands in two places. The **code**: RED → GREEN through the same gate `implement` runs. The **spec**: a surgical AC patch. A small fix record ties the two together.

This skill keeps only its own machinery. Question phrasing → [`../_shared/ask-style.md`](../_shared/ask-style.md). RED classification semantics → [`../implement/references/tdd-loop.md`](../implement/references/tdd-loop.md) — reused, never duplicated. Dispatch policy → [`../_shared/agent-roster.md`](../_shared/agent-roster.md).

Fix-record prose follows `artifact_language` — but a **spec patch matches the existing spec's language** (the file wins over the setting). Code, tests and commits stay English → [`../_shared/artifact-language.md`](../_shared/artifact-language.md).

## Owner

The engineer on the bug drives. Consult the PM / Tech Lead only when triage lands on «spec-bug» or «gap». Changing an AC is a product decision, not a code one.

## Inputs

- `<slug>` — optional. Pass it when you know which feature owns the bug. Otherwise step 2 finds the owner from the symptom.
- The bug report, in any form — a sentence, a stack trace, a failing request, a screenshot description.
- **Soft gate (never hard-refuse):** `docs/features/` with ≥1 `spec.md`. If absent (a brownfield repo that never ran the backbone), still run in **no-spec mode**: steps 1 → 3 → 4 → record. Skip the spec patch. Recommend `survey` in the handoff.
- (Optional) `.claude/sdd.local.md` — gate command overrides. Otherwise the commands are detected per `implement`'s cascade.
- (Optional, project-level override) `docs/.skill-context/sdd-fix/SKILL.md`. If it exists, read it and treat its rules as project-level overrides. On conflict they win. Apply them to all outputs → [`../_shared/skill-context.md`](../_shared/skill-context.md). If absent, do nothing (defaults apply).

No depth dial and no `.size` here. A fix is one size. The interview is the bug report itself.

## Protocol

1. **Intake — reproduce before touching anything.** Ask at most 1–2 `AskUserQuestion` (phrasing per [`../_shared/ask-style.md`](../_shared/ask-style.md)). Ask only what the report does not say: expected vs actual, the steps, the scope (one user? all? since when?). Outcome: a one-line reproduction statement — «doing X, expected Y, got Z». A bug you cannot state this way is not ready to fix.
2. **Trace to spec (triage).** Grep `docs/features/*/spec.md` for the reproduction's domain terms. Also grep the candidate slug's `_fixes/` for a recurrence. Locate the owning slug and the closest §5 AC. In parallel, dispatch [`explorer`](../../agents/explorer.md) — `subagent_type: "sdd:explorer"` (fallback `Explore` / inline per [`../_shared/agent-roster.md`](../_shared/agent-roster.md)) — to localize the code path. Three outcomes (decision table → [`./references/triage.md`](./references/triage.md)):
   - **(a) Regression** — an AC describes the expected behaviour and the code violates it. The spec is right. Only the code changes.
   - **(b) Spec-bug** — the AC exists but a reasonable implementer could read it and produce the observed behaviour. The wording is the root cause. Patch the AC with the user (step 5).
   - **(c) Gap** — no AC covers the behaviour. Add a new AC to §5, marked `<!-- added-by-fix: <date> -->`.
   - **No-spec mode** — no `docs/features/` (or no spec plausibly owns the symptom). Skip the spec patch. Say so in the record. Recommend `survey`.
3. **RED — pin the bug with a failing test.** Write the **minimal** test that reproduces the bug at the level the behaviour implies (unit for a rule, integration for a dependency behaviour, e2e for a flow). Run it. Classify the first run per [`../implement/references/tdd-loop.md`](../implement/references/tdd-loop.md). It must be a **GOOD red** — it fails on the assertion that encodes the *expected* behaviour. Quote the failing line. If no test can pin the bug, STOP and say so — an unverifiable fix is a guess.
4. **GREEN + GATE — minimal fix.** Make the RED test pass with the smallest change. **No drive-by refactors** — anything the fix exposes goes to the record's follow-ups. Then run the same per-task gate `implement` runs: unit + lint + vet (+ integration when available), via the detected commands (detection cascade → [`../implement/references/command-detection.md`](../implement/references/command-detection.md)). If the gate is red, fix it. Never commit around a red gate.
5. **Spec patch + fix record.** Apply the step-2 branch. (a) Nothing to patch — re-check the AC. (b) Patch the AC wording. (c) Add the new AC with the marker. **Confirm any spec change with the user** in one `AskUserQuestion` (show before/after wording). Then write `docs/features/<slug>/_fixes/<date>-<short-slug>.md` from [`./templates/fix-record.md`](./templates/fix-record.md): symptom → root cause → the pinning test → the spec patch (or why there is none).
6. **Commit + handoff.** Propose commit `fix: <slug> <short summary>` with trailers `SDD-Fix: <date>-<short-slug>` and `SDD-AC: <id>` (when an AC was traced). Then **emit the stage-handoff block** per [`../_shared/handoff.md`](../_shared/handoff.md) (utility variant — `/clear` optional): *What I did* + *Review* (the diff, `_fixes/<date>-<short-slug>.md`, the spec patch if any) + *Run next*: resume what you were doing. **When the fix touched >5 files or crossed a module boundary, recommend `/sdd:review <slug>`** — a recommendation, not a gate.

## Definition of Done

- The bug is reproduced by a test that **failed before the fix and passes after** — GOOD red proven, failing line quoted.
- The gate is clean: unit + lint + vet (+ integration where available).
- The triage outcome is explicit — regression / spec-bug / gap / no-spec. The matching spec patch is applied (or its absence is explained in the record).
- `docs/features/<slug>/_fixes/<date>-<short-slug>.md` exists: symptom, root cause, the test, the spec patch, follow-ups.
- The commit carries the `SDD-Fix:` trailer (+ `SDD-AC:` when traced). The user confirmed any spec change.
- The RED-pin (failing test first) + the per-task GATE are this skill's **structural self-check** ([`../_shared/self-check.md`](../_shared/self-check.md)). Report its result in the handoff.

## Anti-patterns

- **Fixing without a pinning test.** «It works now» with no RED proof is a guess that re-breaks silently — the exact failure mode this skill exists to stop.
- **Patching code when the spec was the bug.** If the AC permitted the behaviour, the wording is the root cause. Leave it unpatched and the next implementation reintroduces the bug legally.
- **Silent spec edits.** Every AC patch/addition is confirmed with the user — the spec is a contract, not a scratchpad.
- **Drive-by refactoring.** The fix commit is minimal. Refactors the fix exposed go to the record's follow-ups, not into the same diff.
- **Skipping the gate because the change is «one line».** One-line fixes break suites just fine.
- **Hard-refusing on a repo without specs.** A brownfield bug is this skill's front door — degrade to no-spec mode and recommend `survey`, never block.
- **Writing a parallel test when `_fixes/` shows the same symptom was fixed before.** That is a recurrence — read the old record and **strengthen its test** instead.

## References & template

- [`./references/triage.md`](./references/triage.md) — the symptom→spec trace: grep strategy, the regression / spec-bug / gap decision table, the `added-by-fix` marker, no-spec mode, the recurrence check.
- [`./templates/fix-record.md`](./templates/fix-record.md) — the fix-record scaffold (symptom → root cause → pinning test → spec patch → follow-ups).
- [`../implement/references/tdd-loop.md`](../implement/references/tdd-loop.md) — RED classification (GOOD red / BAD red / false-pass) — the semantics step 3 reuses.
- [`../implement/references/command-detection.md`](../implement/references/command-detection.md) — how the step-4 gate commands are detected (settings override → Makefile → package scripts → language manifests).
- [`../_shared/ask-style.md`](../_shared/ask-style.md) · [`../_shared/agent-roster.md`](../_shared/agent-roster.md) · [`../_shared/handoff.md`](../_shared/handoff.md).

## Example invocation

> **User:** «fix — discounts are applied twice when the user clicks pay twice fast»
> **Skill:** intake confirms: expected one discount per order, got two on a double-click (all users, since the checkout-discounts release). Trace: `docs/features/checkout-discounts/spec.md` AC-04 says «a discount is applied to an order at most once» → the code violates it → **regression**. `explorer` localizes the apply-discount handler (no idempotency check). RED: an integration test posting the same apply twice asserts one discount row — fails with `got 2, want 1` (GOOD red). GREEN: guard on the existing uniqueness key, gate clean. Spec: nothing to patch (AC-04 was right). Record `_fixes/2026-06-12-double-discount.md`, commit `fix: checkout-discounts double-applied discount` + `SDD-Fix:` / `SDD-AC: AC-04` trailers. Handoff: 2 files touched → no review push. Resume.
