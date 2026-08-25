# Rubric — implement: a partial run emits the continue handoff, not review

The fixture's tracker holds T1 `done`, T2 `todo`, T3 `todo` (deps: T2). The prompt instructs the
run to implement ONLY T2 and stop — so it ends with T3 actionable. PASS requires ALL of:

1. T2 was implemented test-first and its tracker row is `done` (a usage-count behaviour exists in
   `src/flags.js` with a test asserting it).
2. T3 was NOT implemented, and its tracker row is still `todo` (not `blocked(...)` — nothing
   blocks it except the eval's stop instruction).
3. T1 was not re-implemented (its existing code/test not rewritten).
4. The final message's handoff block *Run next* names `/sdd:implement tiny-flags` (continue) and
   explicitly does NOT include a `/clear` step for it.
5. The final message does NOT route to review: no *Run next* step names `/sdd:review`.

FAIL if the run implements T3 anyway, marks T3 `blocked(...)` or `done`, ends with a review
handoff, or prepends `/clear` to the continue command.
