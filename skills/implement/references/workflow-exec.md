# Dynamic-workflow execution (`workflow_mode: auto`)

When the decision tree selects the workflow, the engine **generates a `Workflow` script** from the DAG and runs it. This is the unattended, maximally-parallel mode. Each independent task flows through its own pipeline. A failure drops only that task's subtree. Other branches keep going.

## Why a generated workflow (not a fixed one)

The shape of the work is `tasks.json`. It differs every feature. The engine emits a script tailored to this DAG: validate → layer → fan-out → per-task pipeline. The tasks array drives the script as data. The engine fills it in and invokes `Workflow`.

## Generated script shape

```js
export const meta = {
  name: 'sdd-implement-<slug>',
  description: 'TDD-implement <slug> from tasks.json (dynamic DAG)',
  phases: [{ title: 'Implement' }, { title: 'Review' }],
}

// tasks + deps are inlined from tasks.json by the engine
const TASKS = /* [{id, title, acs, dod, files_hint, deps, layer}, ...] */;

// Kahn layers → phases; within a layer, fan out up to the parallel cap.
// Each task is one independent pipeline: write-test → implement → verify → [review] → commit.
const done = new Set();
for (const layer of kahnLayers(TASKS)) {              // computed from deps
  await parallel(layer.map(t => () =>
    pipeline([t],
      () => agent(redPrompt(t),     { phase:'Implement', label:`red:${t.id}`,   schema: RED_VERDICT }),
      r  => agent(greenPrompt(t,r), { phase:'Implement', label:`green:${t.id}`, schema: GATE_VERDICT }),
      g  => agent(verifyPrompt(t,g),{ phase:'Implement', label:`verify:${t.id}`,schema: GATE_VERDICT }),
      v  => agent(reviewPrompt(t,v),{ phase:'Review',    label:`review:${t.id}`,schema: REVIEW_VERDICT }),
    ).then(res => { if (res?.gate_green) done.add(t.id); return {t, res}; })
  ))
}
```

- **Schema-validated verdicts.** Each stage returns a structured verdict (`RED_VERDICT { class: GOOD|BAD|false_pass|NON, failing_line }`, `GATE_VERDICT { unit, integration, lint, vet, gate_green }`, `REVIEW_VERDICT { ac_satisfied, issues[] }`). The orchestrator then branches on data, not prose.
- **Fail drops the subtree.** A stage that throws (or returns `gate_green: false` past retries) drops that task to `null`. The engine removes it from `done`. Every transitively-dependent task is then skipped (its deps never complete). Independent branches finish unaffected. This is the workflow's advantage over a team halt.
- **Parallel cap.** `parallel(...)` respects `max_parallel_agents` (the workflow runtime also caps concurrency). A wide layer queues the overflow.

## Serialization inside the workflow

The same lanes as the team apply. `layer: migration` tasks are forced into a single ordered sub-sequence. Do not place two migrations in the same parallel layer. Chain them via synthetic deps before computing Kahn layers. Tasks with overlapping `files_hint` get a synthetic dep. They then never land in the same parallel batch. A **compile-coupled pair** (shared contract file in `files_hint`) gets the same synthetic dep AND a merged commit step. The pair gets one shared gate and one commit. The commit carries every task's `SDD-Task`/`SDD-AC` trailers ([`tdd-loop.md`](./tdd-loop.md) §COMMIT). Each migration task **promotes** its staged `docs/features/<slug>/migrations/<NN>_*` file into the live `migrations/` (next free number, in ordinal order) before it applies the migration. See [`./inputs.md`](./inputs.md).

## Commit + integration

- The `commit` step of each pipeline produces commits. The engine batches them after the workflow returns if `auto_commit: per_phase`. Commits carry `SDD-Task`/`SDD-AC` trailers. They are serialized in dependency order.
- The integration tier follows `require_integration`. In CI (Docker present) the integration RED→GREEN runs inside the verify stage. Locally under `auto` with no Docker it is NON-red. The proving run then relies on CI for the integration green.

## Graceful fallback

If the `Workflow` tool is **not available** at runtime, the decision-tree guard skips this whole mode. The engine continues with the team (if eligible) or with sequential single-agent TDD. The generated script is never a hard dependency.
