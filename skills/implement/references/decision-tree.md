# Decision tree — picking the execution mode (step 5)

The engine has three logical modes: **sequential single-agent TDD**, **agent team**, and **dynamic workflow/DAG**. Claude Code realizes the latter two with `TeamCreate` / `Workflow`. Codex realizes them with native subagent orchestration (prefer the installed `sdd-*` custom agents). Sequential is the floor. Every degrade path ends at it. The choice is deterministic. The engine makes no judgment call at runtime.

## Inputs to the decision

From step 4 (DAG) and step 2 (settings):

- `task_count` — number of tasks.
- `parallel_width` — max tasks runnable at once (widest Kahn layer).
- `longest_chain` — critical-path length. It is informational. The banner reports it.
- `size` — the feature `.size` (XS/S/M/L/XL), or M if absent.
- settings: `team_mode`, `workflow_mode`, `isolation`, `max_parallel_agents`.
- runtime: is a native workflow runtime available? are native subagents available? (`TeamCreate`
  and `Workflow` are Claude-specific capability names, not the cross-host test.)

## Eligibility

```
parallel_eligible :=
      isolation == "worktree"
  AND max_parallel_agents > 1
  AND parallel_width >= 2
  AND (size in {M, L, XL} OR task_count >= 4)
```

Rationale: parallelism pays off only under four conditions. There is genuinely concurrent work (`parallel_width >= 2`). The feature is non-trivial (`M+` or `>=4` tasks). Agents cannot collide (`worktree`). More than one agent is allowed.

## Selection

```
team_runtime := TeamCreate-available OR native-subagents-available
workflow_runtime := Workflow-available OR native-subagents-available

if team_mode AND parallel_eligible AND team_runtime:
    → AGENT TEAM over the DAG            (see team-exec.md)
elif workflow_mode == "auto" AND parallel_eligible AND workflow_runtime:
    → DYNAMIC WORKFLOW / SUBAGENT DAG     (see workflow-exec.md)
else:
    → SEQUENTIAL single-agent TDD (topo order)
```

`team_mode` wins over `workflow_mode` when both could apply. A human-shaped team with a reviewer is the richer mode. The workflow is the unattended mode.

## Guards (apply before dispatch — they can only make the engine safer)

| Condition | Action |
|---|---|
| `team_mode: true` but `parallel_eligible` is false | Warn («team needs ≥2 parallel tasks and M+/≥4 tasks; this feature has <…>») and **downgrade** to the next applicable mode (workflow if eligible, else sequential). |
| `max_parallel_agents > 1` and `isolation: inplace` | Clamp parallelism to 1 (two agents must never edit one working tree). Effectively sequential. |
| `workflow_mode: off` | Never generate a Workflow, regardless of eligibility. |
| Claude `Workflow` is absent but native subagents exist | Run the host-equivalent subagent DAG; do not downgrade merely because the Claude tool name is absent. |
| Claude `TeamCreate` is absent but native subagents exist | Run the agent-team contract with host-native subagents; in Codex ask for the installed `sdd-*` agents by name. |
| Neither a native workflow nor native subagents are available | Downgrade to sequential. Degrade gracefully — never error. |
| `tdd: false` | Skip the RED step in every mode and warn loudly (you lose the safety net). |
| `require_integration: always` and Docker unreachable | **BLOCK** before dispatch. Do not start work that cannot satisfy its own gate. |
| `require_integration: auto` and Docker unreachable | Proceed. Mark the integration tier NON-red per task. It does not count as pass or fail. |
| `require_integration: never` | Skip the integration tier silently (still run unit + lint + vet). |

## Banner (step 7)

After the tree + guards resolve, print exactly what will happen, e.g.:

```
SDD implement — feature: notification-preferences
  mode          = AGENT TEAM (3 agents)        [team_mode=true, parallel_width=3, size=M]
  tdd           = on
  isolation     = worktree
  integration   = auto (docker: reachable)
  commit        = per_task  (branch: proof/sdd-notification-preferences)
  tasks         = 6   phases = 4   longest_chain = 4
```

The banner is mandatory. The user must see the mode and the settings that drove it before any code is written.
