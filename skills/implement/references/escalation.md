# Escalation — when RED won't go GREEN

A test that stays red after a normal GREEN attempt is a signal, not a nuisance. Climb this ladder in order. Never short-circuit it by weakening the test.

## The ladder (in order)

1. **Re-attempt** up to `max_red_retries` times. Re-read the failing line, the task `acs`, and the relevant `data-model` / `openapi` / `adr`. Often the GREEN attempt missed a detail that the contract already specifies.
2. **More-capable model.** If retries stall, re-dispatch the GREEN step on a stronger model (raise `model_implementer` for this task). A harder task sometimes just needs more capability.
3. **Split the task.** If the task bundles two concerns (e.g. a validation rule *and* an audit write), split it into two tasks with a dep edge. Drive each task with its own RED. Update `tasks.json` + `tracker.md`. The DAG stays the source of truth.
4. **Ask a human — the test may encode a wrong AC.** The code may be right while the *test* asserts something the AC does not require. The AC itself may be wrong. STOP and ask. Surface the failing line, the AC text, and why they conflict. **Never** make the test less strict to pass a wrong AC. Fixing the AC is a `specify`/`clarify` change. The human stays in the loop.
5. **Rollback to the last green.** If none of the steps above resolves it, revert this task's working changes to the last green commit. The tree is then never left broken.

## `stop_on_red` decides what happens to the rest

After the ladder is exhausted on a task:

- **`stop_on_red: true`** (default) → halt the run. **Mark the task `blocked(red:<ladder-step>)` in `tracker.md`** and auto-mark its transitive dependents `blocked(dep:<TaskID>)`. Report the failing line and where in the ladder it stalled. No half-done work is committed. Then emit the **continue** handoff (`/sdd:implement <slug>`, no `/clear`) — never the review handoff: actionable tasks remain (the Completion rule in the spine). Apply «Halted-run hygiene» below.
- **`stop_on_red: false`** → drop this task: its tracker status becomes `blocked(red:<ladder-step>)`, its transitive dependents `blocked(dep:<TaskID>)` (their deps will never complete). Continue the independent branches. The final summary lists every blocked task **as it appears in the tracker**.

The pre-dispatch **BLOCK** guard (`require_integration: always`, Docker absent) is the same shape: the affected tasks are unrunnable, not failed. If the user will not provide the missing tool, mark them `blocked(missing:docker)`; otherwise leave them `todo`. Either way the run ends with the **continue** handoff, not the review handoff.

## Halted-run hygiene

A halt is a pause, not an abort. Before emitting the continue handoff:

1. **Keep the feature branch and every green commit.** Do not delete, reset, or abandon the branch — the resume run continues on it (see [`inputs.md`](./inputs.md) §Repo state).
2. **Remove parallel worktrees** under `.worktrees/` whose task reached a commit or was rolled back (they auto-clean if unchanged, per [`team-exec.md`](./team-exec.md)). Keep a worktree only when it holds uncommitted in-progress work — and say so in the summary.
3. **Update `tracker.md` before the handoff** — the tracker, not the chat history, is what the resume run reads (spine step 5).
4. The handoff's *Run next* **is** the resume command: `/sdd:implement <slug>` (no `/clear`).

## Never

- **Never weaken a test** to get green. The test is the spec made executable. If it is wrong, that is a human decision (step 4).
- **Never commit a red or a skipped hard-gate** as "done". A NON-red integration tier is labelled, not hidden.
- **Never leave the tree broken.** Rollback (step 5) is the floor.
