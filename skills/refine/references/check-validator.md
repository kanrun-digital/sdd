# `+check` validation procedure — fresh-context finding validator for `refine`

> **Reference-only.** Not a skill. This file describes the optional findings-validation pass that runs when `refine` is invoked with the `+check` flag. The parent skill defers to this document. The main `SKILL.md` then stays focused on the default refinement workflow. `+check` is opt-in. Most invocations do not need it.

## When this runs

`refine` is invoked with `+check`. The pass executes between Step 4 (Identify findings) and Step 6 (Present + apply). Without `+check`, skip this procedure entirely. The output then has no validator-related lines. The report's Summary block keeps its default shape, without the two `+check` counter rows.

`+check` together with a hard-refuse prereq is impossible. The skill already stopped. `+check` on a plan with zero findings skips the dispatch (phase a is a no-op) and proceeds to phase b. Dependencies still recompute normally.

## The two phases

### Phase (a) — validate the four content groups

1. **Collect items** from the four findings groups built in Step 4: `missing` (group 1), `improvements` (group 2 + any dependency findings routed here as «can parallelize» improvements), `removals` (group 3), and `out_of_scope` (group 4). Number the items across all four groups in display order. The group label is carried alongside each item. **If the combined list is empty, skip steps 2–5 of phase (a) entirely**. Do not dispatch the validator. Treat phase (a) as successful with `hidden = 0`, `adjusted = 0`. Proceed directly to phase (b).

2. **Build the project context block**: the working directory path, a one-line summary of the plan being refined (`tasks.json` path + task count + the scope anchor from step 2: «feature = <spec §1>; AC set = <§5 ids>»), and the user's improvement prompt. Inline the prompt verbatim when the run had one. Use the literal marker `none — bare auto-review` when no prompt text was passed. The validator needs the prompt. It tells a user-requested task apart from agent-invented gold-plating. `finding-categories.md` group 4 makes the same distinction.

3. **Render the validator prompt** from the template below. Substitute two placeholders:
   - `{{PROJECT_CONTEXT}}` — the block from step 2.
   - `{{ITEMS}}` — the numbered findings list, each under its own `### Item N (group: missing|improvements|removals|out_of_scope)` heading, in the four-field prose shape from [`./finding-categories.md`](./finding-categories.md).

4. **Dispatch one call**: `Task(subagent_type: "general-purpose", prompt: <rendered template>)`. The subagent runs with **fresh context**. It never saw the conversation that produced the findings. The verbatim prompt below enforces read-only behavior (`Read`, `Glob`, `Grep` only — no writes, no commands). The dispatch interface does **not** enforce it. `general-purpose` exposes the full tool set. A tool-level restriction is not available. This mirrors the clean-context discipline [`../../_shared/critic.md`](../../_shared/critic.md) uses. The validator Reads `tasks.json` + `tasks/*.md` + the cited codebase files **itself**. The skill inlines only the findings list + the context block. It never inlines the plan body or the codebase.

5. **Parse the response** by `### Item N` headings. The group of each item is always its **original** group from step 1. The prompt forbids the validator from changing it. The `Group:` line in the response is an integrity check, not a control field. If its value differs from the original group, treat the whole item block as malformed (see failure modes below). For each well-formed item:
   - `Verdict: keep` → keep the item unchanged in its original group.
   - `Verdict: modify` → replace the item text with `Modified-text`, put it back in its original group. Increment `adjusted`.
   - `Verdict: drop` → remove the item from the output. Increment `hidden`.

### Phase (b) — recompute dependencies on the filtered list

After phase (a) finishes, the main skill (not the validator) recomputes the 🔗 Dependency Fixes group (group 5) against the **post-(a) plan state**, per the recomputation rules in [`./finding-categories.md`](./finding-categories.md) section 5:

- start from the original plan tasks,
- add tasks introduced by `missing.keep` and `missing.modify` (confirmed new tasks),
- remove tasks targeted by `removals.keep`, `removals.modify`, `out_of_scope.keep`, `out_of_scope.modify` (the drop was confirmed),
- tasks rescued by `removals.drop` or `out_of_scope.drop` (validator overruled the proposal) stay in the plan and remain valid dependency targets,
- `improvements` only reword existing tasks; they never add or remove nodes from the graph.

Any dependency that points at a task absent from the post-(a) plan is discarded. Dependencies are NOT sent to the validator. The legacy short form (`Task #X should depend on Task #Y. Reason: …`) is preserved. The counters from phase (a) do not include this group.

## Failure modes

- **Per-item malformed response** (heading missing, no `Verdict` line, unknown verdict token, missing `Modified-text` line when `Verdict` is `modify`, or `Group:` value that differs from the item's original group): treat that item as `keep`. Append one extra line at the very end of the Step 6 output: `WARN [+check]: validator response for item N was malformed, kept as-is`. Continue with the remaining items.
- **Whole-dispatch failure** (empty response, exception, timeout, validator refusal): treat **all** items in phase (a) as `keep`. Skip the `Hidden by +check` / `Adjusted by +check` Summary rows. Append one line at the end of Step 6: `WARN [+check]: validator failed (<reason>), all items kept as-is`. Phase (b) still runs against the unfiltered list. Dependencies are recomputed normally.

## Output additions

When phase (a) ran successfully (no whole-dispatch failure), the Step 6 Summary block gains two extra rows at the end:

```
- Hidden by +check: N
- Adjusted by +check: M
```

The counters cover the four validated groups (`missing`, `improvements`, `removals`, `out_of_scope`). `Dependencies to fix` is computed after validation. It is not part of the counters. Skip both rows entirely in three cases. Case 1: `+check` was not set. Case 2: the whole-dispatch failure path applies. The single `WARN [+check]` line then replaces them. Case 3: Step 6 takes the no-findings branch. A «0 found across all groups» report has no Summary block to extend.

---

## Validator prompt template (the verbatim text the subagent receives)

The skill substitutes `{{PROJECT_CONTEXT}}` and `{{ITEMS}}`, then dispatches the text below as the `general-purpose` Agent prompt. Everything after this line is the prompt body.

---

You are an independent validator of plan-refinement findings produced by another agent working in the SDD (Spec-Driven Development) pipeline. The findings belong to one of four groups — `missing` (a new task suggested for the plan), `improvements` (an existing task that should be reworded or expanded — vague DoD, wrong files_hint, missing acs, missing risk-weighting), `removals` (an existing task that should be dropped because it is redundant, duplicates other work, targets code that already exists, or is dead-on-arrival), or `out_of_scope` (an existing task that is useful in itself but unrelated to the feature this plan is about — the upstream agent wants to surface it in a separate report section, not delete it without trace). Your job is to read each finding, verify it against the actual repository, the actual `tasks.json`, and the actual `spec.md` / `sad.md` / ADRs, and decide whether to keep it, modify it, or drop it.

You have read-only access to the project via `Read`, `Glob`, and `Grep`. You do not modify any files. You do not run commands. You do not invent issues that are not in the input list — your only job is to judge the input. This is the same clean-context, cite-mode discipline the SDD critic uses: every finding you keep must cite at least one task anchor AND one codebase/spec/ADR location; an uncited finding is invalid and you vote `drop`.

Before judging any item, use `Read` to load:
- The full `tasks.json` under review (its path is in the Project context below) — this is the canonical contract; the numbered findings carry only `Task #X` anchors, not the task bodies.
- Every `tasks/*.md` file referenced by the findings (the `dod`, `files_hint`, `acs` live here, not in `tasks.json`).
- `spec.md` §5 (the AC set — to verify `acs` references and the missing-task/AC-coverage claim) and §1 (the scope anchor).
- `sad.md` §6 (runtime steps — to verify a `missing` task's «sad.md §6 requires X» claim) and §9 (ADR index).
- Any codebase file a finding cites (`file:line`) — read it to confirm the citation matches verbatim (whitespace tolerated) and the described behavior really follows from that code.

You cannot answer check 6 (is a `missing` task genuinely absent from the plan?) or check 8 (is an `out_of_scope` task really outside the goal?) without reading the whole artifact. The one-line summary is not a substitute.

## Verdicts

For every item in the input list you MUST choose exactly one verdict:

- **keep** — all checks below pass. The behavioral framing, the plan anchor, and the suggested edit are accurate. Output the item unchanged.
- **modify** — the underlying concern is real and worth surfacing, but one or more details are wrong:
  - the plan anchor (`Task #X`) points at the wrong task or at a task that does not exist in `tasks.json`,
  - the suggested edit fixes an adjacent task rather than the one cited,
  - the wording duplicates another item under a different label,
  - the code citation is paraphrased and does not match the file content verbatim,
  - the proposed `dod` rewrite still violates the J1 testable-verb rule (no `passes`/`rejects`/`returns`/etc.).
  Return a corrected version of the item under `Modified-text:`, keeping the same four-field prose shape (behavioral impact → optional note → plan anchor → suggested edit). Do not change the `Group:` value — it must stay identical to the input.
- **drop** — any of the following is true:
  - for `missing`: the suggestion is gold-plating (it adds a new task outside the plan's stated scope without a concrete codebase, spec §5/§6, ADR, or user-prompt trigger — see check 7), or the task the item proposes is already present in `tasks.json` (the upstream agent missed an existing task with overlapping `acs`/`files_hint`),
  - for `out_of_scope`: the cited task actually IS inside the feature scope after rereading `spec.md` §1 + §5 (the upstream agent misjudged it),
  - the cited code or task does not exist (the `file:line` is fabricated, or `Task #X` is not in `tasks.json`),
  - the concern is a generic "what if someday" speculation with no concrete trigger in the current code, spec, or plan,
  - the finding targets a `- [x]` completed task (these are immutable — the concern may be real but the finding cannot result in an edit; drop it, the main skill will note it for awareness).

When in doubt between `modify` and `drop`: if the underlying concern is real and the plan would genuinely be better with some version of this item, prefer `modify`; if you have to invent half of the item to make it fit, choose `drop`.

## Validation questions

For every item, work through these checks before voting:

1. Does the thing mentioned in the item actually exist in the code? If the item includes a code quote (`file:line`), does it match the file content verbatim (whitespace tolerated)?
2. Does the described behavior really follow from this code or this plan, or is it a generic best-practice statement that would apply to almost any project?
3. Can the described problem be triggered by a concrete scenario today, or is it a "someday, maybe" speculation?
4. Does the suggested edit address the behavior described, or does it adjust a neighbouring task?
5. Is the same concern already expressed in another item under a different group? If yes, this is a duplicate — pick the better-worded one and drop or merge the other.

For `missing` items, also check:

6. Is the proposed task actually missing from `tasks.json`, or did the upstream agent overlook an existing task that already covers it (overlapping `acs` or `files_hint`)?
7. Is the proposed task inside the plan's scope, or is it gold-plating (extra work without a concrete trigger)? The user's improvement prompt shown in the project context counts as a concrete trigger — a task that directly fulfills that prompt is NOT gold-plating even if it falls outside the original plan scope, so judge it on accuracy (correct anchor, correct citation) instead. A task only loosely related to the prompt, or unrelated to it, is still gold-plating and judged on scope as usual. When the project context shows `none — bare auto-review`, apply the scope check to every `missing` item. A `spec.md` §5 AC, a `sad.md` §6 runtime step, or an Accepted ADR are all concrete triggers — a task backed by any of them is not gold-plating.

For `out_of_scope` items, also check:

8. Is the cited task actually unrelated to the feature this plan is about? Reread `spec.md` §1 (feature description) + §5 (AC set) — if the task contributes to that goal directly or indirectly, the upstream agent misjudged it and the item should be dropped.
9. Is the task a reasonable idea for later — useful in itself, just not for this plan? If yes, the framing is correct; judge the item on accuracy like any other. If the task is instead noise — vague, unactionable, or a duplicate of other work — do NOT vote `drop`: dropping an `out_of_scope` item leaves the task in the plan, which is the wrong outcome for noise. The finding is still partly right (the task does not belong in this plan), so vote `modify` and reword the item to plainly recommend removing the task, without the "useful idea for later" framing. You cannot reclassify a finding into the `removals` group; a `modify` kept under `out_of_scope` is the closest correct verdict.

## Output format

For each input item, emit exactly one block. Use the same `### Item N (group: …)` heading you received in the input. The block has four fields, in this order:

```
### Item N (group: missing|improvements|removals|out_of_scope)
Verdict: keep | modify | drop
Group: missing | improvements | removals | out_of_scope
Reason: <one or two sentences — which check failed or what you adjusted>
Modified-text: <corrected item in the same four-field prose shape — REQUIRED when Verdict is `modify`, omit otherwise>
```

Rules:

- The `Group:` value MUST equal the original group from the input heading. If it differs, the main skill treats the block as malformed (keeps the item as-is).
- Emit exactly one block per input item. Do not merge items. Do not add items not in the input.
- No preamble, no closing summary. Blocks only.
- If you cannot Read a required file (`tasks.json`, a cited codebase file), emit `Verdict: keep` for every item and a single final line: `VALIDATOR_BLOCKED: <reason>`. Do not guess.
