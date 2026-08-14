---
name: loop
model: inherit
effort: high
agents: [critic, reviewer]
description: >
  Use to run a strict multi-iteration Reflex Loop that polishes one SDD artifact (spec.md,
  sad.md, api/openapi.yaml, sequences, tasks.json, or any feature doc). The loop ends when a
  quality gate passes. It also ends when it reaches iteration or stagnation limits. Each
  iteration runs six phases: PLAN → PRODUCE ‖ PREPARE → EVALUATE → CRITIQUE → REFINE. Steps run
  in parallel where possible. The loop writes state to disk, so the state survives /clear.
  Triggers on "loop {artifact}", "iterate {artifact}", "reflex loop", "polish {artifact} until
  {criterion}", "/sdd:loop {slug}", "рефлексивний цикл", "ітеративно покращуй". Every backbone
  skill already has built-in mini-loops (Socratic loop + critic + self-check). Use /sdd:loop
  when those were not enough. It is a dedicated, gated, resumable loop over one artifact. It
  never runs inline. It dispatches the clean-context critic for EVALUATE and CRITIQUE. It
  reuses _shared/critic.md. It never duplicates that file.
---

# Skill: loop

The **reflexive iteration engine** generalizes the generate→critique→refine cycle into a strict, gated, persistent loop over a single artifact. SDD's backbone skills (`specify`, `design`, `tasks`, …) already contain a *mini-loop*: the Socratic section-by-section pass, a single clean-context critic pass, and a structural self-check. `loop` is the **escape hatch** for when that mini-loop was not enough. Use it when an artifact needs multiple gated iterations to reach a quality bar. Examples: a spec with deep ambiguity, a `sad.md` that keeps drifting, an `openapi.yaml` that fails contract review repeatedly.

It is **orthogonal to the backbone**: it is not a stage in `survey → … → ship`. The user invokes it ad-hoc on one named artifact. The output is the polished artifact + a run record. The loop does **not** commit. The owning skill's commit discipline applies. The user commits the polished artifact as part of that skill's flow. Or `loop`'s handoff names the owning skill for the commit.

Loop prose follows `artifact_language`. The artifact itself follows its owning skill's language rule (a `spec.md` follows `specify`'s rule — `loop` never retro-translates). Run-record fields stay English → [`../_shared/artifact-language.md`](../_shared/artifact-language.md).

## Owner

The owner of the artifact in the loop (PM for spec, Tech Lead/Architect for sad/api/tasks, etc.). This owner confirms the success criteria + iteration limit before iteration 1 starts.

## Inputs

- `<slug>` — the feature slug whose artifact is in the loop. It resolves the artifact path + the persistence dir.
- `<artifact>` — which artifact: `spec` / `sad` / `api` / `sequences` / `tasks` / or an explicit path. The loop reads the owning skill's structural contract for that artifact. The EVALUATE phase checks the artifact against its own DoD, not a generic quality bar.
- Optional: a task prompt — what the ideal result looks like (free text). If absent, the target is the artifact's current state + its owning-skill DoD.
- Optional: success criteria — explicit rules/thresholds. If absent, derive them from the artifact type. A spec → zero §8 open questions + every §5 AC testable. A `tasks.json` → acyclic DAG + every `dod` testable + AC coverage. A `sad.md` → all 12 Arc42 sections present + ADR gate closed. Always ask for confirmation (step 2). Never infer it silently.
- `.claude/sdd.local.md` — for `judgment_model` (the critic/reviewer tier).
- (Optional, project-level override) `docs/.skill-context/sdd-loop/SKILL.md` — if it exists, read it and apply its rules to all outputs. On conflict, the overrides win → [`../_shared/skill-context.md`](../_shared/skill-context.md). Absent → no-op (defaults apply).

## Persistence contract

State lives in `docs/features/<slug>/.loop/`. The directory is created on first run. It is optional (deleted when a loop completes/stops and the user cleans up):

```
docs/features/<slug>/.loop/current.json          # pointer to the active loop (only while active)
docs/features/<slug>/.loop/<task-alias>/run.json # single source of truth for current loop state
docs/features/<slug>/.loop/<task-alias>/history.jsonl  # append-only event log
docs/features/<slug>/.loop/<task-alias>/artifact.md    # the artifact content (single source — never duplicated in run.json)
```

`run.json` holds state, NOT artifact content. `artifact.md` holds content. `history.jsonl` is append-only. Do not create extra index files unless the user asks. State reconstructs fully from disk after `/clear`. Resume reads `run.json` + replays the last `history.jsonl` event.

## Commands

Parse `$ARGUMENTS`:

- `new <artifact> [task prompt]` (or no mode + artifact) — start a new loop
- `resume [alias]` — continue the active loop (or a named one)
- `status` — show active loop state from `current.json`, then STOP
- `stop [reason]` — stop the active loop (`user_stop` if omitted), then STOP
- `list` — list all task aliases + status, then STOP
- `history [alias]` — show event timeline, then STOP
- `clean [alias|--all]` — remove loop files for a stopped/completed/failed loop (user-confirmed), then STOP

`status` / `stop` / `list` / `history` / `clean` are read/control commands. They execute and STOP. They never start an iteration.

## Protocol

1. **Resolve command mode.** If `$ARGUMENTS` is `status`/`stop`/`list`/`history`/`clean` → execute that command from the persistence files. Then STOP. Otherwise (`new` or bare artifact) → start/resume a loop (step 2).
2. **Initialize or resume.**
   - **New loop:** generate `task_alias` — a lowercase-hyphen slug from the artifact + a short topic. Set `run_id` = `<alias>-<yyyyMMdd-HHmmss>`. Write `current.json` (pointer) + initial `run.json`. The initial `run.json` holds: status `running`, iteration 1, `max_iterations` default 4, `phase: A`, thresholds A=0.8/B=0.9, empty `plan`/`evaluation`/`critique`. Create `artifact.md` by copying the current artifact content verbatim. The loop iterates on a working copy. The source artifact is touched only at the end if the user approves.
   - **Resume:** read `run.json` → `current_step` + `iteration`. Read the last `history.jsonl` event to confirm consistency. Re-execute from the interrupted phase. Do not skip. If `status: stopped/completed/failed` → inform the user and suggest `new`.
3. **Confirm success criteria + limits (new loop only, always explicit).** Ask one `AskUserQuestion` (phrasing per [`../_shared/ask-style.md`](../_shared/ask-style.md)). Show the derived rules + thresholds (A=0.8, B=0.9). Show `max_iterations` (default 4). Show the optional completed-phase time budget (default none). Show the artifact's owning-skill DoD as the structural floor. The user confirms or adjusts. Never start iteration 1 without explicit confirmation. This holds even if the task prompt contained criteria. The prompt is a draft. Confirmation is the lock.
4. **Iteration execution (per iteration N):**
   1. **PLAN** (`current_step: PLAN`) — write a short plan for this iteration. Name the sections/rules to focus on. The previous iteration's critique informs it (iteration 1: the whole artifact). Use one `Task` call or inline. Keep it short.
   2. **PRODUCE ‖ PREPARE** (`current_step: PRODUCE_PREPARE`) — after PLAN completes, launch two parallel `Task` calls:
      - **PRODUCE** generates the next artifact revision (writes to `artifact.md`).
      - **PREPARE** generates the check definitions from the rules + the artifact's owning-skill DoD. These are the structural items EVALUATE will check. PREPARE is independent of PRODUCE — both depend only on PLAN.
      - Wait for both. If `Task` is unavailable → run the sequential fallback (PLAN → PRODUCE → PREPARE → EVALUATE → …). The loop must work without parallelism.
   3. **EVALUATE** (`current_step: EVALUATE`) — **here `loop` reuses SDD mechanics. It does not invent its own.** Dispatch the [`critic`](../../agents/critic.md) agent (`subagent_type: "sdd:critic"`. Fallback: `general-purpose` with the prompt body from [`../_shared/critic.md`](../_shared/critic.md)). The critic runs with clean context. It Reads `artifact.md` + the upstream artifacts itself. It probes against the F1–F6 failure classes + the artifact-specific F6 specialization (the owning-skill DoD). For artifacts the critic was not designed for (`api`, `tasks.json`), the F6 specialization comes from the rule-set in [`./references/rule-schema.md`](./references/rule-schema.md) (PREPARE materialized it). Aggregate the critic's findings into a score. Score = passed/total, counted passed/failed per rule. Alternatively, spawn parallel `Task` agents for independent check groups when the rule-set has them. Executable checks run via Bash. Content rules run via Read/Grep.
   4. **Check stop conditions** (step 5) BEFORE you decide to refine. If a stop condition holds, stop with that reason.
   5. **CRITIQUE** (`current_step: CRITIQUE`, only if `passed=false`) — derive a precise issue + fix instructions per failed rule. The critic's findings already carry this (cite-mode: every finding cites an artifact location + an upstream/rule location). CRITIQUE formats them into fix instructions for REFINE.
   6. **REFINE** (`current_step: REFINE`, only if `passed=false`) — rewrite `artifact.md` to address the failed rules. Change **only what the failed rules require**. Do no drive-by rewrites. This is the same discipline `fix` enforces: minimal change, no scope creep. Before overwriting, save a SHA-256 of the previous `artifact.md` in the `refinement_done` event. This gives integrity verification without bloating history.
   7. **Phase A → B transition:** if `phase=A` and `passed=true` → switch to `phase=B`. Activate the B-level rules. Re-run PREPARE + EVALUATE against the same artifact. Do not run PLAN/PRODUCE — the artifact already passed A. If B passes → stop (`threshold_reached`). If B fails → CRITIQUE → REFINE → increment iteration.
   8. **Persist after every phase** (step 6): update `run.json` + append `history.jsonl` event + update `current.json.updated_at` + write `artifact.md` after PRODUCE/REFINE.
5. **Stop conditions (precedence contract — evaluate top-down, first match wins):**
   1. `threshold_reached` — `phase=B` and `passed=true`.
   2. `no_major_issues` — `phase=B` and no `fail`-severity rules failed (only warn/info remain). Never fires in phase A.
   3. `user_stop` — explicit user stop.
   4. `stagnation` — `stagnation_count >= 2`. Delta = score − last_score. If `delta < 0.02` and no fail-blockers, increment.
   5. `budget_exceeded` — `max_completed_phase_seconds` set and accumulated completed-phase time ≥ it (soft — checked at phase boundaries, never interrupts mid-phase).
   6. `iteration_limit` — `iteration >= max_iterations`.
6. **Persistence writes (every phase).** Update `run.json` (incl. `current_step`). Append an event to `history.jsonl` (`plan_created`/`artifact_created`/`checks_prepared`/`evaluation_done`/`critique_done`/`refinement_done`/`phase_switched`/`iteration_advanced`/`phase_error`/`stopped`/`failed`). Update `current.json.updated_at`. Write `artifact.md` after PRODUCE/REFINE. Event payloads carry the score + passed/failed rule ids. Keep them compact. Never dump the full artifact into the conversation.
7. **Post-loop.** Resolve `artifact_status` (`not_created` / `unevaluated` / `stale` / `evaluated`) BEFORE you report any numeric score. Only `evaluated` may report `final_score`. The other statuses print `final_score: unavailable` + the reason. On `iteration_limit`/`budget_exceeded` with `passed=false` + `evaluated`, include a **distance-to-success** block (threshold, gap, failed rule count + ids, rules progress). Set `run.json.status` per the stop reason. `threshold_reached`/`no_major_issues` → `completed`. `user_stop`/`iteration_limit`/`stagnation`/`budget_exceeded` → `stopped`. `phase_error` → `failed`. Delete `current.json` — no active loop remains. Ask the user whether to write `artifact.md` back to the source artifact path (default: yes on `completed`, ask otherwise). This is the only step that touches the source artifact.
8. **Handoff.** Emit the stage-handoff block per [`../_shared/handoff.md`](../_shared/handoff.md) (utility variant — `/clear` optional). Fill *What I did* with loop alias, iterations run, final score, stop reason, artifact_status. Fill *Review* with the `artifact.md` working copy, `run.json`, `history.jsonl`. Fill *Run next* with: resume the owning skill's flow. Example: after looping a `spec.md`, resume `clarify` or `design`. After looping `tasks.json`, resume `refine` or `implement`.

## Definition of Done

- The loop ran ≥1 full iteration (PLAN → PRODUCE → PREPARE → EVALUATE. CRITIQUE/REFINE only if failed) OR stopped cleanly on a non-iteration command.
- EVALUATE actually dispatched the critic (clean context, Read itself) — not skipped, not paraphrased into the main thread.
- `run.json` + `history.jsonl` + `artifact.md` are consistent (state reconstructs from disk).
- The stop reason is one of the six precedence-contract values. `artifact_status` is resolved before any score is reported.
- On `completed`, the user was asked about writing `artifact.md` back to the source.
- The EVALUATE dispatch (clean-context critic) + the persistence consistency are this skill's **structural self-check** ([`../_shared/self-check.md`](../_shared/self-check.md)). Its result is reported in the handoff.

## Anti-patterns

- **Using `loop` where the backbone mini-loop suffices.** `specify`/`design`/`tasks` already have Socratic + critic + self-check. `loop` is the escape hatch for when those were not enough. Do not use it first.
- **Skipping the criteria confirmation.** Even if the task prompt listed rules, step 3 confirms them explicitly. A silent inferred bar leads to runaway iterations.
- **Dumping the full artifact into the conversation.** The artifact is on disk (`artifact.md`). Iteration summaries cite the SHA-256 prefix + changed sections, never the full body.
- **REFINE rewriting more than the failed rules require.** Keep the change minimal — the same discipline `fix` uses. Drive-by rewrites pollute the diff and hide regressions.
- **Inventing an EVALUATE that bypasses `critic.md`.** The critic is the canonical clean-context judge. `loop` dispatches it with an F6 specialization for non-spec/sad artifacts. It does not build a parallel evaluator.
- **Touching the source artifact mid-loop.** The loop iterates on `artifact.md` (working copy). The source is written only at post-loop step 7, with user approval.
- **Forcing context clears.** Recommend after iteration 2 / on phase transition / at iteration ≥3, but the user decides.
- **A run that never persists.** Every phase writes to disk. A loop that only holds state in conversation is not resumable. The persistence contract exists to prevent exactly this bug.

## References

- [`./references/phase-contracts.md`](./references/phase-contracts.md) — strict I/O contracts for each of the 6 phases (PLAN/PRODUCE/PREPARE/EVALUATE/CRITIQUE/REFINE).
- [`./references/rule-schema.md`](./references/rule-schema.md) — the rule format (id/description/severity/weight/phase/check) + score calculation + the F6 specialization table for non-spec/sad artifacts.
- [`../_shared/critic.md`](../_shared/critic.md) — the clean-context critic dispatch + F1–F6 skeleton. EVALUATE reuses it, never duplicates.
- [`../_shared/agent-roster.md`](../_shared/agent-roster.md) · [`../_shared/ask-style.md`](../_shared/ask-style.md) · [`../_shared/handoff.md`](../_shared/handoff.md) · [`../_shared/self-check.md`](../_shared/self-check.md).

## Example invocation

> **User:** «/sdd:loop checkout-discounts spec — polish until every AC is testable and zero §8 OQ remain»
> **Skill:** `status`/`list` → none active. `new`: alias `spec-polish`, `run_id` `spec-polish-20260807-130500`. Step 3 confirms: rules = [every §5 AC testable (fail), zero §8 OQ (fail), §6 NFR carry measurement (warn), §1 scope clear (warn)], thresholds A=0.8/B=0.9, max_iterations=4, budget=none → user confirms. Iteration 1: PLAN (focus §5 + §8) → PRODUCE ‖ PREPARE (artifact revision + check defs from specify's DoD) → EVALUATE (critic dispatched, clean context, Reads spec.md + sad.md. Score 0.6, 2 fail) → CRITIQUE (3 ACs non-testable, 1 OQ open) → REFINE (rewrite 3 ACs to testable form, resolve the OQ inline) → persist. Iteration 2: EVALUATE score 0.85 → phase A→B. Iteration 3: EVALUATE B score 0.92 ≥ 0.9 → `threshold_reached`, `completed`. Post-loop: `artifact_status=evaluated`, final_score 0.92, ask user → yes, write back to `spec.md`. Handoff → resume `clarify` (skip — zero OQ) → `design`.
