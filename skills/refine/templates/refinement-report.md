# Refinement report — `refine` Step 6 output scaffold

> **Template-only.** Not a skill. `refine` step 6 renders the approved-for-presentation findings into this shape before the `AskUserQuestion`. The emoji-grouped sections stay for scannability. The items inside «🆕 Missing», «📝 Improvements», «🗑️ Removals», and «💡 Out of scope» all follow the **same four-field prose shape** from [`../references/finding-categories.md`](../references/finding-categories.md) — no labeled `Why:` / `Issue:` / `Fix:` fields. The «🔗 Dependency Fixes» group uses the short legacy form.

Report prose follows `artifact_language`. Task ids, `files_hint` paths, code citations, and the `acs` ids stay verbatim (they are machine-anchored). Render every group heading even when empty — a «0 found» line is required for scannability (the user must see that a category was checked, not skipped).

---

```md
## Plan Refinement Report

Plan: `docs/features/<slug>/tasks.json` (+ `tasks/<N>.md` × <count>)
Size + route: <size> + <route> (from `.size` / `.route`)          ← omit the line if either is absent
Scope anchor: feature = <spec §1 one-line>; AC set = <§5 ids>
Tasks analyzed: <N> (of which <M> completed `- [x]` — immutable)

### Findings

#### 🆕 Missing Tasks (<N> found)
<!-- 0 found → «None — every spec §5 AC and every sad.md §6 runtime step has a covering task.» -->
1. <four-field prose: behavioral impact → optional citation → plan anchor «after Task #X» → suggested edit (full proposed task text + dod)>

#### 📝 Task Improvements (<N> found)
<!-- 0 found → «None — every dod carries a testable verb, every files_hint is concrete, every risk-weighted task carries risk:high.» -->
1. <four-field prose: behavioral impact → optional citation → plan anchor «Task #X» → suggested edit (full replacement dod / files_hint / acs)>

#### 🔗 Dependency Fixes (<N> found)
<!-- Computed LAST (after the other groups, and after +check filtering when the flag is set).
     0 found → «None — the DAG is correctly ordered; every consuming task is blocked-by its producer.» -->
1. Task #X should depend on Task #Y. Reason: <one sentence — what X consumes from Y, and the failure mode if implement schedules them out of order>

#### 🗑️ Removals (<N> found)
<!-- 0 found → «None — no duplicates, no tasks for already-existing code, no dead-on-arrival tasks.» -->
1. <four-field prose: behavioral impact (wasted effort / parallel implementation risk) → citation (the existing code file:line or the duplicate task) → plan anchor «Task #X» → suggested edit (remove + re-anchor dependents)>

#### 💡 Out of scope — for later (<N> found)
<!-- 0 found → «None — every task traces to an AC, a sad.md §6 step, an ADR, or the user's refinement prompt.» -->
1. <four-field prose: behavioral impact (scope creep without payoff) → citation (the unrelated module / missing AC) → plan anchor «Task #X» → suggested edit (drop from active plan; capture elsewhere if worth revisiting)>

#### 📋 Summary
- Missing tasks: <N>
- Tasks to improve: <N>
- Dependencies to fix: <N>
- Tasks to remove: <N>
- Out of scope: <N>
<!-- Append these two rows ONLY when +check ran successfully (no whole-dispatch failure): -->
- Hidden by +check: <N>
- Adjusted by +check: <N>
<!-- When +check had a whole-dispatch failure, replace the two rows above with a single line: -->
<!-- WARN [+check]: validator failed (<reason>), all items kept as-is -->
<!-- When +check was not set, omit all three of the above. -->
```

---

## After the report — the apply question

Immediately after rendering the report, emit ONE `AskUserQuestion` (phrasing per [`../../_shared/ask-style.md`](../../_shared/ask-style.md)):

```
Apply these refinements?

1. Yes, apply all   (Recommended when the report is short and the findings are well-cited)
2. Let me pick which ones
3. No, keep the plan as is
```

Based on the choice:
- **Yes, apply all** → apply every finding synchronously to `tasks/*.md` AND `tasks.json` (step 6 writeback).
- **Let me pick which ones** → present findings in batches of up to 4 per `AskUserQuestion`. Each finding's options are `Apply` / `Skip`. Continue until all are resolved. Apply only the approved subset.
- **No, keep the plan as is** → exit without modifications, commit nothing, emit the forward handoff (the plan is unchanged, and `plan-tests` / `implement` proceed on the original).

---

## Completion block (after writeback)

When changes were applied, emit this as the final user-facing summary (the handoff block per [`../../_shared/handoff.md`](../../_shared/handoff.md) follows it):

```md
## Plan Refined

Changes applied:
- Added <N> new tasks (T<id>…)
- Improved <N> task definitions (dod / files_hint / acs / risk)
- Fixed <N> dependencies
- Removed <N> redundant or out-of-scope tasks

Updated plan: `docs/features/<slug>/tasks.json` + `tasks/*.md`
Total tasks: <N> (was <M>)
self-check: 6/6 pass

Ready to continue:
/clear, then /sdd:plan-tests <slug>   (or /sdd:implement <slug> if plan-tests' N/A condition holds)
```

When the user chose «keep the plan as is» (no changes), emit instead:

```md
## Plan Reviewed, No Changes

The plan stood up to the second pass — no findings were approved.
self-check: 6/6 pass (no writeback needed; tasks.json unchanged)

Ready to continue:
/clear, then /sdd:plan-tests <slug>   (or /sdd:implement <slug> if plan-tests' N/A condition holds)
```
