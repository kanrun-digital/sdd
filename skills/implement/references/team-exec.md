# Agent-team execution (`team_mode: true`)

When the decision tree selects the team, the engine becomes a **lead**. The lead coordinates three roles through a shared task list. Each agent gets one git worktree. The lead serializes commits. Use this mode for features with genuine parallel width that want an independent review pass.

## Roles (the shipped subagents)

Spawn each agent by its plugin-namespaced `subagent_type`: `sdd:test-author`, `sdd:implementer`, `sdd:reviewer` (see [`../../_shared/agent-roster.md`](../../_shared/agent-roster.md) §Dispatching).

- **[`test-author`](../../../agents/test-author.md)** (`sdd:test-author`) — RED only. Writes the failing test(s) for a task's `acs`. Runs them. Classifies the first run (GOOD/BAD/false-pass/NON-red per [`tdd-loop.md`](./tdd-loop.md)). Hands over the quoted failing line. Never writes production code.
- **[`implementer`](../../../agents/implementer.md)** — GREEN + REFACTOR + GATE. Takes a task with its red test. Writes the minimal code to pass. Refactors while green. Runs the per-task gate. Never weakens the test.
- **[`reviewer`](../../../agents/reviewer.md)** — read-only. Two stages. Stage-1 checks spec/AC compliance: does the change satisfy the `acs` it claims? Stage-2 checks quality: conventions, edge cases, anti-patterns. Has no write tools.

## Setup

1. Create the team (`TeamCreate`). Seed a shared **TaskList** from `tasks.json`. **The full task text goes in each task body**: title, `acs` text pulled from spec §5, `dod`, `files_hint`. Teammates do NOT read the plan or the conversation. The task body is their whole brief.
2. Give each agent its own git **worktree** under `.worktrees/<agent>`. `isolation: worktree` is required for the team. The guard enforces it. No two agents share a tree.
3. Set per-role **model + effort** from `model_*` / `effort_*` + the `.size` scaling. Export the env vars for the dispatch. Follow [`../../_shared/agent-roster.md`](../../_shared/agent-roster.md) for all of this. Roster defaults: test-author/implementer `sonnet`+`medium`, reviewer `opus`+`high`. Print the resolved per-role model+effort in the banner.

## Flow per task

`test-author` (RED) → `implementer` (GREEN+REFACTOR+GATE) → `reviewer` (review). A task advances only when its `deps` are `done`. The lead pulls ready tasks off the DAG and assigns them. Up to `max_parallel_agents` run at once.

## Serialization lanes (the lead enforces)

Even with worktrees, some tasks must not run concurrently:

- **`layer: migration`** — migrations are an ordered sequence (e.g. golang-migrate's numbered files). Run them one at a time, in order. Each migration task first **promotes** its staged `docs/features/<slug>/migrations/<NN>_*` file into the live tree (next free number, in ordinal order). It applies the migration only after promotion. See [`./inputs.md`](./inputs.md).
- **Overlapping `files_hint`** — two tasks that touch the same file run in the same lane (serialized). Or the second rebases on the first. Compute lanes from `files_hint` intersections up front.
- **Compile-coupled pair** — a shared-contract change + its implementer(s) share the contract file in `files_hint`. The rule above puts them in one lane. The lead also gives the pair a synthetic dep (contract → implementer). The lead closes the pair with **one shared gate + one commit**. That commit carries every task's `SDD-Task`/`SDD-AC` trailers ([`tdd-loop.md`](./tdd-loop.md) §COMMIT). Neither task is separately committable green.

Tasks in different lanes with satisfied deps run in parallel. Tasks in the same lane queue.

## Commits

The lead **serializes commits in dependency order** regardless of when the work finished. Pull each agent's worktree changes for a `done` task. Commit them on the feature branch with the `SDD-Task`/`SDD-AC` trailers ([`tdd-loop.md`](./tdd-loop.md)). The history stays linear and bisectable even though the work was concurrent.

## Don't over-orchestrate

- **<4 tasks → no team.** The eligibility check already forbids it. If you reached this mode with a tiny DAG, downgrade to sequential. Coordination overhead exceeds the gain.
- A red that survives escalation in one lane follows `stop_on_red`. The lead halts the whole team, or drops that task, auto-blocks its dependents, and lets other lanes finish ([`escalation.md`](./escalation.md)).
- Tear the team down at the end. Remove worktrees. They auto-clean if unchanged.
