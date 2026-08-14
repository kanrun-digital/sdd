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

- **`stop_on_red: true`** (default) → halt the run. Report the blocked task, the failing line, and where in the ladder it stalled. No half-done work is committed.
- **`stop_on_red: false`** → drop this task. **Auto-block its transitive dependents** (their deps will never complete). Continue the independent branches. The final summary lists every dropped + blocked task with the reason.

## Never

- **Never weaken a test** to get green. The test is the spec made executable. If it is wrong, that is a human decision (step 4).
- **Never commit a red or a skipped hard-gate** as "done". A NON-red integration tier is labelled, not hidden.
- **Never leave the tree broken.** Rollback (step 5) is the floor.
