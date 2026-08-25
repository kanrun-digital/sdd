# Rubric — implement: blocked-only tracker routes to review with disclosure

The fixture's `docs/features/tiny-flags/tasks/tracker.md` holds T1 `done`, T2 `blocked(OQ-1)`,
T3 `blocked(dep:T2)` — the actionable set is empty from the start. PASS requires ALL of:

1. **No task was (re-)implemented.** T1's existing `src/flags.js` / `src/flags.test.js` were not
   rewritten (whitespace-identical or untouched in the diff), and no new production code for
   T2/T3 (no usage counter, no counts helper) appears anywhere.
2. **The tracker still shows** T2 `blocked(OQ-1)` and T3 `blocked(dep:T2)` — the statuses were
   not flipped to `todo`/`done` and the reason-refs were not stripped.
3. The run acknowledged the resume state (e.g. a `resume:` summary naming 1 done / 2 blocked /
   0 actionable, or equivalent wording).
4. The final message's handoff block routes forward: *Run next* names `/sdd:review tiny-flags`
   (with `/clear` as its step 1), and does NOT tell the user to continue implementing.
5. **Blocked disclosure:** the final message lists T2 and T3 as blocked WITH their reason-refs
   (`OQ-1` and `dep:T2` respectively).

FAIL if the run implements or unblocks T2/T3, drops the reason-refs, ends with a continue
handoff (`/sdd:implement`), or hands off to review without naming the blocked tasks.
