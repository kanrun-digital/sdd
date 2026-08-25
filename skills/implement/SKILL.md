---
name: implement
model: inherit
effort: medium
agents: [test-author, implementer, reviewer]
description: >
  Use to implement a feature from its tasks.json with test-driven development. Writes
  a failing test first, makes it pass, refactors, gates, and commits per task.
  Triggers on "implement {slug}", "build {slug}", "TDD {slug}", "code up the tasks for
  {slug}", "/sdd:implement {slug}", "імплементуй {slug}", "реалізуй фічу {slug}",
  "напиши код за задачами". Reads docs/features/{slug}/tasks.json + the upstream
  artifacts. Detects the repo's test/lint/vet commands stack-agnostically. Builds a
  dependency DAG. Runs one of three logical modes: sequential single-agent TDD, an agent team
  (TeamCreate or native Codex subagents), or a dynamic workflow/DAG. The skill selects the mode from settings + DAG
  shape, with graceful fallback. Hard-refuse if tasks.json is missing.
---

# Skill: implement

The implementation engine. It turns `tasks.json` into committed, tested code through a strict TDD cycle per task — `SELECT → RED → GREEN → REFACTOR → GATE → COMMIT` — and orchestrates that cycle in one of three modes (sequential / agent-team / dynamic-workflow) picked by an unambiguous decision tree. Everything is stack-agnostic: the test, lint, and vet commands are **detected**, never hard-coded.

This file is the spine. Each step delegates to a file in `references/`.

## Owner

Tech Lead drives. The engine runs the cycle. The three subagents ship with the plugin: [`test-author`](../../agents/test-author.md) (RED), [`implementer`](../../agents/implementer.md) (GREEN/REFACTOR/GATE), [`reviewer`](../../agents/reviewer.md) (read-only review).

## Inputs

- `<slug>` — feature slug.
- **Gate (hard refuse):** `docs/features/<slug>/tasks.json`. Missing → «run `tasks <slug>` first».
- Read for context (the agents read these directly, not via paraphrase): `spec.md` (AC), `data-model.md` + the **staged** migrations under `docs/features/<slug>/migrations/` (a `layer: migration` task **promotes** these into the live `migrations/` tree — see [`./references/inputs.md`](./references/inputs.md)), `contracts/openapi.yaml`, `test-plan.md`, `sad.md`, Accepted `adr/`.
- `docs/features/<slug>/tasks/tracker.md` — **the resume ledger**. Read at start; the source of truth for `done` / `blocked(<reason-ref>)`. Absent → treat every task as `todo` (first run). → [`./references/inputs.md`](./references/inputs.md) §Resume state.
- Settings: `.claude/sdd.local.md` (auto-created with documented defaults if absent — normally by `specify` at the backbone start, and `implement` creates it too if you jump straight here) → [`./references/settings.md`](./references/settings.md).
- (Optional, project-level override) `docs/.skill-context/sdd-implement/SKILL.md` — if it exists, read it and treat its rules as project-level overrides (conflict → they win and apply to all outputs) → [`../_shared/skill-context.md`](../_shared/skill-context.md). Absent → no-op (defaults apply).

## Protocol

1. **Preconditions.** Check that `tasks.json` exists and parses. Load the upstream artifacts list. Detail → [`./references/inputs.md`](./references/inputs.md).
2. **Settings.** Read `.claude/sdd.local.md`. If absent, auto-create it with the documented defaults (frontmatter + the «What each key does» body, self-documenting) and patch `.gitignore` (`.claude/*.local.md`, `.worktrees/`) — the same template `specify` writes. → [`./references/settings.md`](./references/settings.md).
3. **Detect commands.** Run the stack-agnostic cascade (settings override → Makefile → package scripts → language manifests → Docker probe for the integration tier) to resolve unit / integration / lint / vet commands. Print what was detected. → [`./references/command-detection.md`](./references/command-detection.md).
4. **Build the DAG.** Parse `tasks.json`, validate `deps` is acyclic, topologically sort into phases (Kahn). Compute `task_count`, `longest_chain`, `parallel_width`. Mark serialization lanes (`layer: migration`, tasks with overlapping `files_hint`).
5. **Resume from the tracker.** Read `docs/features/<slug>/tasks/tracker.md`. A `done` task is skipped — never re-implemented, never silently re-verified (the whole-feature gate re-proves composition at the end). A `blocked(<reason-ref>)` task stays blocked unless the user says the reason is resolved — then flip it to `todo` in the tracker first. Compute the **actionable set** per the Completion rule below. Print the resume summary: `resume: <done>/<total> done, <blocked> blocked, <actionable> actionable`. Tracker absent → every task is `todo` (first run). → [`./references/inputs.md`](./references/inputs.md) §Resume state.
6. **Pick the mode.** Run the decision tree (below. Full form → [`./references/decision-tree.md`](./references/decision-tree.md)). Apply the guards.
7. **Generate the run-plan.** Sequential → an ordered task list (actionable tasks only). Team → a shared task plan with the full task text in each body. Workflow → a native `Workflow` script when that runtime exists; under Codex, the parent orchestrates the same Kahn phases with native subagents. → [`./references/team-exec.md`](./references/team-exec.md) / [`./references/workflow-exec.md`](./references/workflow-exec.md).
8. **Banner.** Print the active mode and the settings that drove it: `mode=<…> tdd=<…> isolation=<…> parallel=<n> integration=<…>`. The user sees exactly how the engine will behave before it acts.
9. **Execute** in the chosen mode. Every task runs the TDD cycle → [`./references/tdd-loop.md`](./references/tdd-loop.md). A `layer: migration` task first **promotes** its staged migration(s) (`docs/features/<slug>/migrations/<NN>_*`) into the live `migrations/` tree — assigning the real sequence number / timestamp per the repo's convention, in ordinal order — *then* applies + reverts them. Detail → [`./references/inputs.md`](./references/inputs.md).
10. **Per-task gate + commit.** After GREEN+REFACTOR: unit + (integration if available) + lint + vet must be clean, then commit task-scoped with trailers `SDD-Task: <id>` and `SDD-AC: <id>` (one per satisfied AC). Tasks in one **compile-coupled lane** (shared contract file in `files_hint`) pass one shared gate and one commit carrying every task's trailers — the sanctioned exception in [`./references/tdd-loop.md`](./references/tdd-loop.md) §COMMIT. Update `tracker.md` → `done`.
11. **Summary + hand off.** Report covered AC, commits made (with `SDD-Task` trailers), every `blocked(<reason-ref>)` task as it appears in the tracker, and the per-task gate results. Then **emit the stage-handoff block** per [`../_shared/handoff.md`](../_shared/handoff.md) — *What I did* (covered AC, commits with `SDD-Task` trailers, gate results, blocked tasks with their reason-refs) + *Review* (the committed diff + `tasks/tracker.md`) + *Run next* **state-dependent per the Completion rule**: actionable set empty (every task `done` or `blocked(<reason-ref>)`) → run the whole-feature gate, then `/clear` + `/sdd:review <slug>` (a clean-context pass over the whole diff), then `/sdd:ship <slug>`; actionable tasks remain (halt / BLOCK / interruption) → `/sdd:implement <slug>` to continue, **no `/clear`**, and never offer `review`. In team mode the [`reviewer`](../../agents/reviewer.md) may also run per-task, but the authoritative independent review of the whole change lives in the `review` skill — `implement` does not self-certify.

## Decision tree (compact)

```
parallel_eligible := isolation==worktree AND max_parallel>1 AND parallel_width>=2
                     AND (size in {M,L,XL} OR task_count>=4)

team_runtime := TeamCreate-available OR native-subagents-available
workflow_runtime := Workflow-available OR native-subagents-available

if team_mode AND parallel_eligible AND team_runtime:           → AGENT TEAM over the DAG
elif workflow_mode=="auto" AND parallel_eligible AND workflow_runtime: → DYNAMIC / SUBAGENT DAG
else:                                                           → SEQUENTIAL single-agent TDD (topo order)
```

**Guards (apply before dispatch):** `team_mode` but not eligible → warn + downgrade to the next mode. `max_parallel>1` with `isolation: inplace` → clamp parallel to 1 (no two agents edit one tree). `workflow_mode: off` → never run the workflow-equivalent branch. `tdd: false` → skip RED (warn loudly — you lose the safety net). `require_integration: always` but Docker absent → **BLOCK** before dispatch. `auto` → run unit-only and mark integration NON-red. `never` → skip the integration tier. Full table → [`./references/decision-tree.md`](./references/decision-tree.md). Graceful degrade: fall through to sequential only when neither the host-native workflow nor native subagents are available.

## Completion rule

> **actionable** := tracker status ∉ {`done`, `blocked(...)`} AND every task in `deps` is `done`.

A run MUST NOT end while the actionable set is non-empty — the only exceptions are a `stop_on_red: true` halt and a pre-dispatch BLOCK, and those end with the **continue** handoff (`/sdd:implement <slug>`, no `/clear`), never the review handoff. The review handoff is emitted only when the actionable set is empty: every task `done` or `blocked(<reason-ref>)`. «Reported as blocked» means exactly one thing: the task's tracker Status cell is `blocked(<reason-ref>)` — `OQ-<n>` (spec §8 open question) · `red:<step>` (escalation ladder exhausted) · `dep:<TaskID>` (blocked dependency) · `missing:<thing>` (named external fact/tool). Prose in the summary is not a block.

## TDD cycle (per task)

`SELECT → RED → GREEN → REFACTOR → GATE → COMMIT`. The RED step is load-bearing: write the test first, run it, and **classify the first run** — GOOD red (assertion fails / unimplemented) vs BAD red (the test itself won't compile → fix the test) vs false-pass (green immediately → the test is too weak, strengthen it) vs NON-red (skipped because Docker is absent → governed by `require_integration`, counts as neither red nor green). Quote the failing line before writing any production code. Escalation on persistent red → [`./references/escalation.md`](./references/escalation.md): more-capable model → retry → split the task → if the test encodes a wrong AC, **ask a human** (never weaken the test) → rollback to the last green. `stop_on_red` decides halt vs drop-and-continue (dependents auto-block).

## Definition of Done

- Every task in `tasks.json` is either committed (test-first, gate-clean, `SDD-Task`/`SDD-AC` trailers) or carries tracker status `blocked(<reason-ref>)` — a named reason, not prose.
- Unit gate green. Integration green where available (or NON-red recorded with the policy reason). Lint + vet clean per the detected commands.
- The active mode + settings were printed in the banner before execution.
- `tracker.md` reflects final status. The summary reports the gate results, and the handoff routed per the **Completion rule** (review only when no actionable tasks remain; otherwise continue) — `implement` does not self-certify the whole change.
- The per-task GATE (unit + integration + lint + vet) is this skill's **structural self-check** ([`../_shared/self-check.md`](../_shared/self-check.md)). Report its results in the handoff.

## Anti-patterns

- **Code before the test.** RED first, always (unless `tdd: false`, which warns).
- **Weakening a test to make it pass.** If the AC is wrong, ask a human and fix the AC. Never edit the test to be less strict.
- **Skipping the RED classification.** A false-pass that looks green hides a useless test.
- **Parallel agents editing one working tree.** Parallelism requires worktree isolation — the guard clamps it.
- **Committing with a red or skipped gate** and calling it done. A NON-red integration tier must be labelled, not hidden.
- **Spawning a team for <4 tasks** — coordination overhead exceeds the gain. The eligibility check forbids it.
- **Claiming integration passed when Docker was absent.** Report NON-red honestly.
- **Handing off to `review` with actionable tasks remaining.** Three of ten tasks done is a *continue* handoff (`/sdd:implement`, no `/clear`), not a review handoff.
- **«Blocked» in prose only.** A block that is not `blocked(<reason-ref>)` in the tracker does not exist — the resume run and `review`'s gate read the tracker, not the chat.

## References & template

`inputs.md` · `settings.md` · `command-detection.md` · `decision-tree.md` · `tdd-loop.md` · `team-exec.md` · `workflow-exec.md` · `escalation.md` — all in [`./references/`](./references/).
