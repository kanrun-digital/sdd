# Phase contracts — strict I/O for each of the 6 loop phases

> **Reference-only.** Not a skill. `loop` step 4 dispatches 6 phases per iteration; this file is the single source for each phase's input, output, and the parallel/sequential rules. The parent skill keeps only the orchestration; the phase shapes live here.

## Phase dependencies (the DAG)

```
PLAN
  │
  ├──→ PRODUCE   ┐
  │              ├── parallel (both depend only on PLAN)
  └──→ PREPARE   ┘
         │
         └──→ EVALUATE   (depends on PRODUCE's artifact + PREPARE's checks)
                │
                ├── (passed=true) ──→ phase A→B transition OR stop
                └── (passed=false) ──→ CRITIQUE ──→ REFINE ──→ increment iteration
```

- **PLAN** is sequential (one call).
- **PRODUCE ‖ PREPARE** run as parallel `Task` calls (inter-phase parallelism). Both depend only on PLAN output. If `Task` is unavailable → sequential fallback (PRODUCE then PREPARE); the loop must work without parallelism.
- **EVALUATE** is sequential after both complete; it may spawn *intra-phase* parallel `Task` agents for independent check groups (executable checks via Bash, content rules via Read/Grep).
- **CRITIQUE → REFINE** are sequential, only on `passed=false`.

`current_step` in `run.json` tracks the logical position: `PLAN` → `PRODUCE_PREPARE` (one step, not two — the parallel pair is atomic) → `EVALUATE` → `CRITIQUE` → `REFINE`.

---

## PLAN

**Input:** the task prompt (or `none — bare polish`), the previous iteration's critique (iteration 1: nothing; later iterations: the CRITIQUE output), the success criteria + thresholds, the artifact's owning-skill DoD.

**Output:** a short plan for this iteration — which sections/rules to focus on, the approach, the expected change shape. Stored in `run.json.plan` (compact — a list of focus items, not prose).

**Rules:** keep it short (a plan that's longer than the artifact is a smell). Focus, not re-survey.

---

## PRODUCE

**Input:** the PLAN, the current `artifact.md` (iteration 1: the source artifact copy; later: the REFINE output), the owning-skill structural contract (so the revision stays structurally valid).

**Output:** the next revision of `artifact.md`. Written to disk (the single source — never duplicated in `run.json`).

**Rules:** produce the WHOLE artifact (not a patch) — REFINE later targets failed rules; PRODUCE is the full revision informed by PLAN. Stack-agnostic; follow the owning skill's language + structure rules.

---

## PREPARE

**Input:** the success criteria rules, the artifact's owning-skill DoD, the PLAN focus.

**Output:** the check definitions EVALUATE will run — materialized from [`./rule-schema.md`](./rule-schema.md). For rules with an executable `check` (a command, a grep, a schema validation), PREPARE renders the exact check expression. For content rules (structural, completeness), PREPARE renders the verification prompt fragment. Stored in `run.json.prepared_checks` (compact).

**Rules:** PREPARE is independent of PRODUCE — it materializes checks from the rule-set + DoD, not from the artifact content. Parallel-safe.

---

## EVALUATE

**Input:** `artifact.md` (from PRODUCE or REFINE) + `prepared_checks` (from PREPARE) + the upstream artifacts the artifact links to (e.g. a `spec.md` EVALUATE reads `architecture-map.md`; a `tasks.json` EVALUATE reads `spec.md` §5 + `sad.md` §6).

**Output:** per-rule verdict (pass/fail/warn/info) + an aggregate score (passed/total, weighted by `weight`) + the `passed` boolean (score ≥ threshold). Stored in `run.json.evaluation` (compact: score, passed, failed rule ids, warn rule ids). Append `evaluation_done` to `history.jsonl` with the score + passed/failed in the payload.

**Dispatch (the SDD-native core):** EVALUATE dispatches the [`critic`](../../agents/critic.md) agent — `subagent_type: "sdd:critic"` (clean context, Read itself) — probing the artifact against F1–F6 from [`../../_shared/critic.md`](../../_shared/critic.md), with an **F6 specialization** for the artifact type:
- `spec.md` / `sad.md` — the critic's native F6 (implementation-detail leakage into AC; quality scenarios citing absent NFR numbers; strawman ADR options).
- `api` / `openapi.yaml` — F6 = contract drift (endpoints not traced to spec §5 AC; status codes violating the api drift-check matrix; missing idempotency on writes).
- `tasks.json` — F6 = the `tasks` step-12 self-check (acyclic deps, AC coverage, testable-verb dod, J5 lint).
- `sequences` — F6 = AC-to-flow coverage (every §5 AC mapped to a flow/branch/N/A).

For artifact types without a native critic F6, the rule-set's `check` field (materialized by PREPARE) defines the probe. Alternatively, spawn parallel `Task` agents for independent check groups when the rule-set separates executable checks (Bash) from content rules (Read/Grep).

**Rules:** the evaluator is strict and non-creative — it judges, it does not propose new content (that's REFINE's job, driven by CRITIQUE). Cite-mode: every failed rule cites an artifact location + a rule/upstream location.

---

## CRITIQUE

**Input:** the EVALUATE output (failed rules + their citations).

**Output:** per-failed-rule fix instructions — what specifically to change, where, and why. Stored in `run.json.critique` (compact: rule id → fix instruction). Append `critique_done` to `history.jsonl`.

**Rules:** CRITIQUE formats the critic's findings into actionable fix instructions; it does not re-judge. One fix instruction per failed rule, citing the artifact location.

---

## REFINE

**Input:** `artifact.md` + the CRITIQUE fix instructions.

**Output:** the rewritten `artifact.md` — changed ONLY where the failed rules require. Written to disk. Before overwriting, save SHA-256 of the previous `artifact.md` in the `refinement_done` event payload (`previous_artifact_hash`). Append `refinement_done` to `history.jsonl`. Increment `iteration` in `run.json`.

**Rules:** minimal change — the same discipline `fix` enforces. No drive-by rewrites (anything REFINE exposes goes to a follow-up note, not into the same diff). The artifact must remain structurally valid per the owning-skill contract after the rewrite.

---

## Phase A → B transition (the two-tier quality bar)

Phase A is the structural/basic bar (threshold default 0.8); phase B is the stricter quality bar (threshold default 0.9). A clean A-evaluation does NOT stop the loop — it transitions to phase B:

1. EVALUATE passes phase A (`phase=A`, `passed=true`, score ≥ 0.8).
2. Switch `phase` to `B`; activate B-level rules (the stricter subset; PREPARE re-materializes them).
3. Re-run PREPARE (phase=B checks) + EVALUATE against the SAME artifact (no PLAN/PRODUCE — the artifact already passed A).
4. B passes (score ≥ 0.9) → stop `threshold_reached`, `completed`.
5. B fails → CRITIQUE → REFINE → increment iteration (now refining against B-level rules).

A clean A-evaluation that moves to B is shown in full once (the Step 8 full-output exception) for visibility; B-level EVALUATE runs immediately after.
