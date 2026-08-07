---
name: refine
model: inherit
effort: high
agents: [explorer]
description: >
  Use to run a second iteration over a written task plan — re-analyzes the codebase deeper
  than /sdd:tasks did, surfaces gaps (missing tasks, vague DoD, wrong dependencies, duplicates,
  out-of-scope gold-plating), and applies approved fixes to BOTH tasks/*.md AND tasks.json
  atomically. Optionally (+check) validates each finding through a fresh-context subagent before
  anything is applied. Triggers on "refine {slug}", "improve the plan for {slug}",
  "second pass on tasks {slug}", "plan refinement {slug}", "/sdd:refine {slug}", "покращ план {slug}",
  "друга ітерація задач {slug}", "перевір план {slug}". Reads tasks.json + tasks/* + spec.md §5 +
  sad.md §6/§9 + Accepted ADRs + (if present) data-model.md / contracts/openapi.yaml, dispatches
  a clean-context validator when +check is set, then writes back atomically. Hard-refuses if
  tasks.json is missing. Optional stage (never auto-runs); offered as the ↳ or alternative in
  tasks' handoff.
---

# Skill: refine

The **plan-refinement stage** — a formalized second iteration over a task plan that `tasks` produced. `tasks` writes the plan and hands off to `plan-tests` / `implement`; `refine` inserts an *optional* checkpoint where the plan is re-read against the codebase with fresh eyes, **before** code is written. It exists because first-pass task decomposition routinely misses integration points, hides vague DoDs, mis-orders dependencies, and sneaks in gold-plating — and once `implement` starts, every gap becomes expensive rework.

This is a refinement pass, not a re-authoring stage: it does **not** regenerate `tasks.json` from scratch. It applies surgical edits to both the markdown task files and `tasks.json` — which must stay in lockstep (per [`../tasks/SKILL.md`](../tasks/SKILL.md): the markdown and the JSON reflect one model, no translation layer to drift). The scope anchor is `spec.md` §1 (feature description) + §5 AC — a finding outside that scope is routed to **out-of-scope**, not silently added.

Refinement-report prose follows `artifact_language`; the `tasks.json` machine fields (`id`, `layer`, `deps`, `acs`, `files_hint`, `slug`, `risk`) stay English → [`../_shared/artifact-language.md`](../_shared/artifact-language.md). Existing task `dod` prose in tasks/*.md matches the file's language (the file wins over the setting — never retro-translate mid-refine).

## Owner

Tech Lead (the planner who owns task decomposition). They approve which findings apply — `refine` proposes, the Tech Lead disposes.

## Inputs

- `<slug>` — feature slug.
- Optional flags: `+check` (validate findings via a fresh-context subagent before applying), `@<path>` (explicit tasks dir override — rarely needed).
- Optional: an improvement prompt in free text (a specific concern to focus the refinement).
- **Gate (hard refuse):** `docs/features/<slug>/tasks.json` AND `docs/features/<slug>/tasks/`. Missing → STOP and point: «run `/sdd:tasks <slug>` first — refine sharpens an existing plan, it does not write one».
- Read directly (not via an index): `tasks.json`, every `tasks/*.md`, `spec.md` §5 AC + §1, `sad.md` §5 module boundaries + §6 runtime + §9 ADR index, each Accepted ADR, and — if present — `data-model.md` and `contracts/openapi.yaml` (so contract-presence findings J3 land correctly).
- `.size` / `.route` (read for context: route-aware skip behaviour, risk-weighting depth — never refuse on absence).

## Protocol

1. **Prereq (hard).** `test -f docs/features/<slug>/tasks.json` AND `test -d docs/features/<slug>/tasks`. Either missing → refuse, naming the missing one. Read `.size`/`.route` for context; do not refuse on their absence.
2. **Load context.** Read `tasks.json` (the canonical contract — start here), then every `tasks/*.md` (`_epic.md` + each `<task-slug>.md`). Then the upstream the plan links to: `spec.md` §1 + §5 AC, `sad.md` §5/§6/§9, each Accepted ADR, `data-model.md` / `contracts/openapi.yaml` if present. Identify which tasks are already completed (`- [x]` in `_epic.md` / `tracker.md`) — they are immutable (rule 2). Capture the scope anchor in one line: «feature = <spec §1 one-line>; AC set = <§5 ids>».
3. **Deep re-analysis (deeper than tasks step 3).** Dispatch [`explorer`](../../agents/explorer.md) — `subagent_type: "sdd:explorer"` (fallback `Explore` / inline per [`../_shared/agent-roster.md`](../_shared/agent-roster.md)) — scoped per task cluster, **not** the whole feature at once:
   - For each task: does the codebase already partially implement what the task describes? (a task for code that exists = `removals` finding)
   - Hidden dependencies the plan missed (a handler that needs a migration the plan omits; a UI task that needs a new API endpoint the plan doesn't list)
   - Shared utilities/services the plan should reuse instead of creating new ones (a task that invents a repo that already exists = `removals`)
   - Integration points: API routes, config files, middleware, import/export, validation patterns — anything the plan's `files_hint` should name but doesn't (= `improvements`)
   - Edge cases per the tech stack: error handling, null safety, authz checks, rate limiting (= `missing`)
   - **Run 1-2 Explore agents in parallel**, "medium" thoroughness — this is targeted verification, not a full re-survey. Synthesize the findings into task-anchored notes.
4. **Identify findings — 5 categories** (full definitions, examples, and the prose shape each finding follows → [`./references/finding-categories.md`](./references/finding-categories.md)):
   - **missing** — a task that should exist but doesn't (migration, config, edge-case AC not covered by any task's `acs`).
   - **improvements** — an existing task with a vague `dod` (violates the J1 testable-verb rule from `tasks`), a wrong/imprecise `files_hint`, a missing `acs` link, missing risk-weighting (`risk: high` for auth/payment/migration/PII per J4).
   - **dependencies** — wrong task order (B depends on A but A comes after B in the DAG), a missing `deps` edge (C consumes A's output but isn't blocked-by A), an **unnecessary** serialization (two tasks could run in parallel — flagged as an improvement, not a finding on its own unless the chain is on the critical path).
   - **removals** — a duplicate task (two tasks doing the same thing), a task whose deliverable already exists in the codebase, a dead-on-arrival task (its precondition can never hold).
   - **out_of_scope** — a task that looks useful in itself but is unrelated to the feature this plan is about (gold-plating). Routed to its own report section so the user sees the idea before it's dropped — the skill does not persist out-of-scope items anywhere; capturing them elsewhere (backlog, issue tracker) is the user's call.

   Every finding carries: (a) **behavioral impact** — what breaks or becomes harder if the plan stays as-is; (b) optional **citation** — a codebase fact (`file:line`), an existing pattern, or a spec/ADR §ref; (c) a **plan anchor** — `Task #<id>` reference (or «after Task #<id>» for new tasks); (d) a **suggested edit** — concrete change: add / reword / remove. No vague «consider reviewing X» — every finding is discrete & actionable (the same finding-qualification gate [`../review/references/review-dimensions.md`](../review/references/review-dimensions.md) uses).

5. **`+check` validation (optional, only when the flag is set).** Between step 4 and step 6, run the procedure in [`./references/check-validator.md`](./references/check-validator.md):
   - Number the findings across the four content groups (`missing`, `improvements`, `removals`, `out_of_scope`) — `dependencies` is **not** sent (it is recomputed after).
   - Dispatch one `Task(subagent_type: "general-purpose")` with the rendered template — the validator runs with **fresh context**, Read/Glob/Grep only (enforced by the prompt, not the dispatch interface — `general-purpose` exposes the full tool set). It re-reads `tasks.json` + `tasks/*.md` + the cited codebase files itself, and returns `keep` / `modify` / `drop` per finding.
   - Apply verdicts: `keep` → unchanged; `modify` → replace with `Modified-text` (validator rewrote the citation or anchor); `drop` → remove (increment the «Hidden by +check» counter).
   - **Recompute dependencies** against the post-validation plan state (add `missing.keep/modify` tasks, remove `removals.keep/modify` + `out_of_scope.keep/modify` targets, rescue anything the validator overruled). The legacy short form `Task #X should depend on Task #Y. Reason: …` is preserved — dependencies are never sent to the validator.
   - Failure modes: malformed per-item response → treat as `keep` + WARN; whole-dispatch failure (empty/exception/timeout) → all items `keep` + single WARN line, dependencies still recomputed.
6. **Present + apply.** Render the refinement report per [`./templates/refinement-report.md`](./templates/refinement-report.md) — emoji-grouped (`🆕 Missing` / `📝 Improvements` / `🔗 Dependency Fixes` / `🗑️ Removals` / `💡 Out of scope`), each finding in the four-field prose shape. Then ONE `AskUserQuestion` phrased per [`../_shared/ask-style.md`](../_shared/ask-style.md):
   - **Yes, apply all** → apply every approved finding.
   - **Let me pick which ones** → present each finding individually (batch up to 4 per question); options `Apply` / `Skip`.
   - **No, keep the plan as is** → exit without modifications, commit nothing, handoff forward.
   On approval, apply changes **synchronously** to `tasks.json` AND `tasks/*.md`:
   - Add new tasks → new `<task-slug>.md` from the `tasks` template + a row in `tasks.json` (next `T<N>` id, preserving the existing id space) + an entry in `_epic.md`'s flowchart if it changes the DAG shape.
   - Improve a task → `Edit` the `<task-slug>.md` (`dod`, `files_hint`, `acs`) AND the matching `tasks.json` object in the same pass.
   - Fix dependencies → update `deps` in both the markdown and `tasks.json`.
   - Remove a task → `TaskUpdate`-equivalent: delete the `<task-slug>.md`, remove the `tasks.json` object, drop its `_epic.md` row; any task that depended on it must be re-anchored (its `deps` updated to the surviving target, or the dependency dropped with a note).
   - **Never touch a `- [x]` completed task** — if a finding targets one, it is a no-op (report it as «completed — surfaced for awareness, not modified»).
   - Re-validate the `_epic.md` flowchart per [`../_shared/mermaid-check.md`](../_shared/mermaid-check.md) if the DAG shape changed.
7. **Self-check + handoff.** Re-read `tasks.json` from disk (per [`../_shared/self-check.md`](../_shared/self-check.md)) and verify **6 items**: (1) `deps` still acyclic (Kahn succeeds); (2) every `acs` entry is a real `spec.md` §5 AC id; (3) every task's `dod` contains a testable verb (J1 — `passes`/`rejects`/`returns`/`applies`/`renders`/`redirects`/`records`/`blocks`/`emits`/`fails on <input>`); (4) no `- [x]` completed task was modified; (5) `tasks.json` and `tasks/*.md` are in sync (same ids, same `deps`, same `acs` — one model); (6) every `risk: high` field (J4) is preserved on auth/payment/migration/PII tasks. Fix + re-check ≤2 cycles; surface anything unresolved. Then **emit the stage-handoff block** per [`../_shared/handoff.md`](../_shared/handoff.md) — *What I did* (counts: N missing added, N improved, N deps fixed, N removed, N out-of-scope dropped; + the «self-check: 6/6 pass» line; + any `+check` counters when it ran) + *Review* (`tasks/`, `tasks.json`) + *Run next*: `/clear`, then **resolve the next stage per `.route`** (Routes in [`../_shared/size-matrix.md`](../_shared/size-matrix.md)) — `/sdd:plan-tests <slug>` (or `/sdd:implement <slug>` directly when plan-tests' N/A condition holds: every task's DoD already names its test).

## Definition of Done

- The refinement report was presented (5 categories, even if some are empty — a «0 found» line per group is required for scannability) and the user approved a subset (or none).
- Approved findings were applied **synchronously** to both `tasks/*.md` and `tasks.json` — no drift between the two (one model, per the `tasks` contract).
- No `- [x]` completed task was modified (immutability rule).
- When `+check` ran, the validator dispatch actually happened (fresh context, Read itself) — not skipped, not paraphrased into the main thread; its counters appear in the report.
- The structural self-check (6 items above) passes or its unresolved items are surfaced honestly.
- The commit (if any changes applied) carries the `SDD-Refine:` trailer; the handoff block is emitted as the final output.
- The synchronous writeback (tasks.json ↔ tasks/*.md) + the 6-item structural self-check are this skill's **structural self-check** ([`../_shared/self-check.md`](../_shared/self-check.md)); its result is reported in the handoff.

## Anti-patterns

- **Regenerating the plan from scratch.** `refine` improves the existing plan; it does not replace it. A full rewrite loses the planner's intent and the upstream links.
- **Modifying a completed task.** `- [x]` tasks are immutable — a finding against one is surfaced for awareness, never applied.
- **Silent gold-plating.** A «useful» task outside the feature scope goes to the **out_of_scope** section, not into `missing`. The user sees the idea and consciously drops it.
- **Drift between `tasks.json` and `tasks/*.md`.** They must reflect one model; editing only one is the bug this skill exists to prevent.
- **Inventing findings without a codebase or spec citation.** Every finding cites at least one task anchor AND one codebase/spec/ADR location (cite-mode, same as [`../_shared/critic.md`](../_shared/critic.md)). An uncited finding is dropped.
- **Skipping `+check` when it was requested.** The flag is a contract — if set, the validator dispatch happens; on failure, the WARN surfaces, never a silent skip.
- **Sending dependencies to the validator.** The 🔗 Dependency Fixes group is computed **after** validation against the filtered plan — it never enters the validator prompt.
- **Re-ordering the id space.** New tasks take the next free `T<N>`; removed tasks leave a gap (do not renumber — downstream consumers and review records cite ids).
- **Touching `tasks.json` schema.** No new top-level keys; the only field additions allowed are backwards-compatible per-task fields `tasks` already defines (`risk`, etc.).

## References & template

- [`./references/finding-categories.md`](./references/finding-categories.md) — the 5 finding categories: full definitions, examples, and the four-field prose shape every finding follows.
- [`./references/check-validator.md`](./references/check-validator.md) — the `+check` procedure: substitution slots, dispatch contract, verdict semantics, failure modes, output additions.
- [`./templates/refinement-report.md`](./templates/refinement-report.md) — the report scaffold (emoji-grouped sections, summary counters, `+check` rows when applicable).
- [`../tasks/SKILL.md`](../tasks/SKILL.md) — the `tasks.json` contract (schema, `deps` DAG rules, `layer` serialization, `files_hint` overlap lanes, J1-J4 self-check gates) — `refine` writes back to the same contract.
- [`../_shared/agent-roster.md`](../_shared/agent-roster.md) · [`../_shared/ask-style.md`](../_shared/ask-style.md) · [`../_shared/handoff.md`](../_shared/handoff.md) · [`../_shared/self-check.md`](../_shared/self-check.md) · [`../_shared/mermaid-check.md`](../_shared/mermaid-check.md) · [`../_shared/size-matrix.md`](../_shared/size-matrix.md).

## Example invocation

> **User:** «/sdd:refine checkout-discounts +check»
> **Skill:** prereq passes (`tasks.json` + `tasks/` exist; `.size=S`, `.route=standard`). Loads `tasks.json` (8 tasks, T1-T8), all `tasks/*.md`, `spec.md` §5 (AC-01..AC-06), `sad.md` §6 (the apply-discount flow). Dispatches `explorer` scoped to the discount module. Step 4 produces: **missing** (1 — no task covers the idempotency-key check that `sad.md` §6 step 2 requires; AC-04 «at most once» is uncovered); **improvements** (1 — T4 `dod` says «handles duplicate apply» — non-testable, rewrites to «rejects a second apply-discount within 5s with 409»); **dependencies** (1 — T5 should depend on T2, the migration it reads from); **removals** (0); **out_of_scope** (1 — T7 «refactor the logging module» is unrelated to discounts). `+check` validates: 3 keep, 0 modify, 0 drop (the missing idempotency task has a concrete `sad.md` §6 trigger → not gold-plating). Report rendered; user picks «Yes, apply all». Writes: new `tasks/T9-idempotency-check.md` + `tasks.json` row; T4 `dod` rewritten in both; T5 `deps` updated; T7 dropped (file deleted, `tasks.json` object removed, `_epic.md` row gone, flowchart re-validated). Self-check 6/6 pass. Commit `refine: checkout-discounts — 1 added, 1 improved, 1 dep fixed, 1 dropped (+check: 0 hidden)` + `SDD-Refine:` trailer. Handoff → `/clear` → `/sdd:plan-tests checkout-discounts`.
