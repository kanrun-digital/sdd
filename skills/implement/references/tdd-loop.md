# TDD loop — the per-task cycle (step 8)

Every task runs `SELECT → RED → GREEN → REFACTOR → GATE → COMMIT`. The cycle is the same for every runner: the sequential agent, a team `implementer`, or a Workflow stage. The RED step carries the method. Skip its discipline and the whole method collapses into "write code, write a test that happens to pass".

## SELECT

Pick the next task whose `deps` are all `done`. In sequential mode that is the topo order. In parallel modes the orchestrator hands it out. Read the task body + its `acs` from `spec.md §5` + the relevant `test-plan.md` rows. Before you write anything, know what observable outcome the test will assert.

## RED — write the failing test first

1. Write the test(s) for this task's `acs` **before any production code**. Put them where the repo keeps tests for that layer (detected, not assumed).
2. Run the unit command. Capture the output.
3. **Classify the first run** — this is mandatory and must be stated aloud:

   | Class | What it looks like | Action |
   |---|---|---|
   | **GOOD red** | test compiles, runs, fails on an assertion or «not implemented» | proceed to GREEN |
   | **BAD red** | the test itself won't compile / import-errors / references a symbol that the test got wrong | the test is broken, not the code — **fix the test**, re-run, re-classify |
   | **false-pass** | green on the very first run, before any production code | the test is too weak (asserts nothing real) — **strengthen it** until it's GOOD red |
   | **NON-red** | skipped because its dependency is unavailable (e.g. Docker absent for an integration test) | not a pass and not a fail — record NON-red, governed by `require_integration` |

4. **Quote the failing line** (the assertion + expected-vs-actual, or the «undefined: X» line) before you write any production code. The quote proves that the test exercises the right thing.

A task with only a NON-red integration test and no unit coverage cannot be driven by TDD locally. Write the unit-level RED too. Let the integration RED land in CI (the proving-run pattern).

## GREEN — minimal code to pass

Write the **least** code that turns the quoted failing assertion green. Add no speculative generality. Make no unrelated edits. Touch nothing outside the task's `files_hint`. Re-run the unit command. Confirm the previously-quoted failure is now green. Confirm nothing else broke.

## REFACTOR — clean while staying green

Tidy names, extract helpers, remove duplication. Re-run the unit command after each change. If a refactor goes red and is not trivially fixable, **revert it**. The task's job is the GREEN, not the cleanup.

## GATE — the task isn't done until this is clean

Run, per the detected commands + settings:

- **unit** — must be green.
- **integration** — green if available. Record NON-red if Docker is absent under `require_integration: auto`. BLOCK was already enforced for `always`.
- **lint** (if `gate_lint` and a linter resolved) — clean.
- **vet/typecheck** (if `gate_vet` and a command resolved) — clean.

Any hard-gate failure (unit red, integration red when it ran, lint/vet errors) means the task is not done. Fix it, or escalate (see [`escalation.md`](./escalation.md)).

## COMMIT — task-scoped, traceable

When `auto_commit: per_task`, commit only this task's files with a message like:

```
<type>(<slug>): <task title>

<one-line what + why>

SDD-Task: T3
SDD-AC: AC-02
SDD-AC: AC-04
```

Write one `SDD-AC` trailer per AC the task satisfied. The `SDD-Task` trailer ties the commit to `tasks.json`. Then mark the task `done` in `tracker.md`. (`per_phase` batches a phase's tasks into one commit. `off` leaves committing to the user but still updates the tracker.)

**Compile-coupled lane exception.** Tasks in one compile-coupled lane cannot each be committed green alone. A lane is a shared-contract change + its implementer(s). `tasks` marks it via the shared contract file in `files_hint`. The contract change breaks every implementer at compile time. The lane runs **one shared GATE and one commit**. The commit carries an `SDD-Task` trailer **per task** and all of their `SDD-AC` trailers together. The body names the coupling (e.g. «compile-coupled: T3 interface change + T4 implementation»). This is a sanctioned exception to task-scoped commits. It is not a license to batch unrelated tasks.

In parallel modes the **lead serializes commits in dependency order** even though the work happened concurrently. The history stays linear and bisectable.

## WHOLE-FEATURE gate — before handing off to review (W2-adjacent)

The per-task GATE proves each task green in isolation. It does **not** prove the tasks compose. Task T2's change can break T1's test when they touch different files. Example: T2 changed a shared helper's signature. T1's test imports it. T2's own GATE does not catch that. T2's test does not exercise T1's path.

After **all** tasks are committed, run **one whole-feature gate** before emitting the handoff to `review`:

1. Run the **full suite end-to-end** (unit + integration + lint + vet) on the final HEAD of the feature branch. Do not run only the files the last task touched.
2. If any test that was green at its task's GATE is now red, that is a cross-task regression. Fix it before handing off. Re-enter the TDD loop for the responsible task. Do **not** defer it to `review`. `review` is read-only (it does not run tests). A red suite at review means a loop-back to `implement` that could have been caught here for free.
3. Record the whole-feature gate result in `tracker.md` (one line: `whole-feature gate: <unit/integration/lint/vet counts> at <commit>`).

This is cheap insurance against the most common multi-task integration failure. It also keeps `review` focused on the diff's correctness, not on «why is this green task now red».

**Interaction with `require_integration: auto` + NON-red.** If the whole-feature gate runs with the integration tier NON-red (Docker absent locally), surface that explicitly in the handoff. `ship`'s G5 warning depends on this signal being visible. The bet is still that CI runs the integration tier. The whole-feature gate makes that bet explicit, not silent.
