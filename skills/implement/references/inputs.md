# Inputs + preconditions (step 1)

## Hard gate

`docs/features/<slug>/tasks.json` must exist and parse as JSON. Missing or malformed → refuse: «run `tasks <slug>` first (it emits tasks.json)». Do not reconstruct tasks from the markdown. `tasks.json` is the contract.

## Validate the contract

The loaded `tasks.json` must satisfy the shape from the `tasks` skill:

- top-level `{ slug, tasks: [...] }`.
- each task: `id` (unique), `title`, `layer`, `deps` (array of existing ids), `acs` (array), `dod` (string), `files_hint` (array).
- `deps` forms a DAG (no cycles) — verified in step 4. A cycle is a hard error: report the cycle and stop (it is a `tasks` bug, not an `implement` one).

## Scaffold task sets (from `survey` greenfield)

A `tasks.json` with `slug: "_scaffold"` and `layer: scaffold` tasks comes from `survey`'s greenfield foundation. It does not come from `tasks`. These tasks have **no feature `acs`**. They create the project skeleton (structure, baseline module, test harness, migration tooling, CI, conventions doc). Handle them specially:

- **The skeleton smoke test is the red→green anchor**, not a feature AC. RED = «the project does not build / boot / the tooling doesn't run». GREEN = «build + boot + the empty test suite + the migration tool all succeed». Write that smoke test as part of the scaffold (task S2 in the foundation contract). Drive the skeleton to make it pass. Do not run per-folder TDD theatre.
- Read `docs/architecture-map.md` (`mode: greenfield-bootstrap`) for the exact stack + conventions to scaffold to.
- After the scaffold is green, the repo is real. The normal per-feature flow (`specify → … → implement`) then builds into it with real feature TDD.

## Context the agents read directly

The engine does **not** paste these into prompts. Each agent (or the sequential runner) reads them itself. This prevents paraphrase drift:

- `docs/features/<slug>/spec.md` — §5 acceptance criteria (the source of truth for what each test asserts).
- `docs/features/<slug>/test-plan.md` — the AC→test map, if `plan-tests` ran. **For XS/S the plan is usually inline instead** — a `## Test plan` section in `spec.md` (per the size matrix). Check both locations. Read whichever exists.
- `docs/features/<slug>/data-model.md` + the **staged** migration files under `docs/features/<slug>/migrations/` — the schema the code targets. A `layer: migration` task promotes them into the live `migrations/` tree. See «Staged migrations → promote» below.
- `docs/features/<slug>/contracts/openapi.yaml` — the API contract handlers must match.
- `docs/features/<slug>/sad.md` + Accepted `adr/` — the architecture and the locked decisions.
- `docs/architecture-map.md` (from `survey`, if present) — the conventions of the existing system. The new code must match them: module wiring, error handling, IDs, tests, migrations. **For a `ui` surface**, §Frontend / UI foundation lists the design system / components / tokens / styling to reuse. The map also gives the closest precedent to copy, including the **closest UI precedent** for a new screen. This saves the agents re-discovering the patterns.

## Staged migrations → promote before running

`data-model` stages each migration as `docs/features/<slug>/migrations/<NN>_<verb>_<entity>.up.sql` + `.down.sql` (feature-local ordinal). Staged files live **not** in the live `migrations/` tree. A design-stage schema therefore cannot reach a real DB before the feature is built. The `layer: migration` task(s) own **promotion**:

1. **Promote in ordinal order.** For each staged `<NN>_*` pair (ascending), copy it into the repo's live `migrations/` directory. Follow the repo's detected convention. Sequential → the **next free number** (`000023_*`). Timestamped → a fresh timestamp. Preserve the intra-feature order. Assign the number **now, at promote-time**. Two features that build at the same time then never collide. Copy the SQL body **verbatim**. Never rewrite it during promotion. After promotion the live file is canonical. The staged copy is the frozen design record. Git keeps it. Do not hand-edit it.
2. **Then apply + verify.** Run the migration with the repo's tool against the (ephemeral, testcontainers) DB. Check the task's DoD «migration applies and reverts cleanly» on the promoted file. The feature's integration tests run against the promoted schema.
3. **Post-promote drift re-check (W9).** After promotion, `diff` the staged pair (`docs/features/<slug>/migrations/<NN>_*.{up,down}.sql`) against the promoted live file(s). Any **non-whitespace** difference is a finding. This catches a specific bug: someone hand-edited the live migration after promotion (a column type, a constraint, a default). The design record then drifted. Without the check, the bug surfaces only as a silent schema/data divergence in prod. Surface a drift finding in the task's commit message + the tracker. Carry it forward to `review` (it is a contract-fidelity smell). Ignore whitespace-only diffs (trailing newline, line-ending).
4. **Commit** the promoted live file(s) with the migration task. `data-model` already committed the staged pair under `docs/features/<slug>/migrations/`. If the post-promote drift check (step 3) found a non-whitespace difference, the commit message names it: `migration: <slug> promote (drift: <file> — flagged for review)`.

A `layer: migration` task with **no** staged file under the feature's `migrations/` is a `tasks`/`data-model` mismatch. Surface it. Do not invent SQL.

## `ui`-layer tasks

A `layer: ui` task is present only when `sad.md` frontmatter `target_surfaces` declares a UI surface (`web-frontend` / `mobile-app` / `desktop-app`). It runs through the **same TDD cycle** as any other task. It follows the **repo's frontend test convention**, not a backend assumption. Command-detection detects component / e2e-through-UI runners from `package.json` scripts (Playwright / Storybook / a visual-diff tool / etc.). No engine change is needed. Command-detection already picks up frontend scripts in its cascade.

**Reuse the UI foundation (don't reinvent).** A `ui` task **composes the existing design system** from `architecture-map.md` §Frontend. Reuse the existing components / shared primitives. Pull design tokens (colors / spacing / typography) from the repo's token source. Build in the repo's **one** styling approach. Find the **closest existing screen/component** (the §Frontend UI precedent). Extend or compose it. Write a **new** component only when no existing primitive fits. Build it in the repo's styling approach. Never build a second one. This is the frontend echo of "match the repo + copy the closest precedent" → [`../../_shared/surfaces.md`](../../_shared/surfaces.md).

## Repo state

- Note the current branch. If `branch_strategy: feature` and the repo is on its default branch, create or switch to a feature branch before any commit (see [`settings.md`](./settings.md)).
- Do not touch unrelated dirty changes. Work only the files each task's `files_hint` names.
