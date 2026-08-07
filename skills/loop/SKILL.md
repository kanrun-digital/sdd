---
name: loop
model: inherit
effort: high
agents: [critic, reviewer]
description: >
  Use to run a strict multi-iteration Reflex Loop that polishes a single SDD artifact (spec.md,
  sad.md, api/openapi.yaml, sequences, tasks.json, or any feature doc) until a quality gate passes
  or iteration/stagnation limits are reached. Six phases per iteration — PLAN → PRODUCE ‖ PREPARE →
  EVALUATE → CRITIQUE → REFINE — with parallel execution where possible and persistence to disk so
  state survives /clear. Triggers on "loop {artifact}", "iterate {artifact}", "reflex loop",
  "polish {artifact} until {criterion}", "/sdd:loop {slug}", "рефлексивний цикл", "ітеративно
  покращуй". Distinct from the built-in mini-loops (Socratic loop + critic + self-check) every
  backbone skill already has: /sdd:loop is for when those weren't enough — a dedicated, gated,
  resumable polish loop over one artifact. Never runs inline; dispatches the clean-context critic
  for EVALUATE/CRITIQUE (reuses _shared/critic.md, never duplicates it).
---

# Skill: loop

The **reflexive iteration engine** — a generalization of the generate→critique→refine cycle into a strict, gated, persistent loop over a single artifact. SDD's backbone skills (`specify`, `design`, `tasks`, …) already contain a *mini-loop*: the Socratic section-by-section walk + a single clean-context critic pass + a structural self-check. `loop` is the **escape hatch** for when that mini-loop wasn't enough — when an artifact needs multiple gated iterations to reach a quality bar (a spec with deep ambiguity, a `sad.md` that keeps drifting, an `openapi.yaml` that fails contract review repeatedly).

It is **orthogonal to the backbone**: not a stage in `survey → … → ship`. Invoked ad-hoc on whichever artifact the user names. Output is the polished artifact + a run record; the loop does **not** commit (the owning skill's commit discipline applies — the user commits the polished artifact as part of that skill's flow, or `loop`'s handoff names the owning skill for the commit).

Loop prose follows `artifact_language`; the artifact itself follows its owning skill's language rule (a `spec.md` follows `specify`'s rule — `loop` never retro-translates). Run-record fields stay English → [`../_shared/artifact-language.md`](../_shared/artifact-language.md).

## Owner

The owner of the artifact being looped (PM for spec, Tech Lead/Architect for sad/api/tasks, etc.). They confirm the success criteria + iteration limit before iteration 1 starts.

## Inputs

- `<slug>` — the feature slug whose artifact is being looped (resolves the artifact path + the persistence dir).
- `<artifact>` — which artifact: `spec` / `sad` / `api` / `sequences` / `tasks` / or an explicit path. The loop reads the owning skill's structural contract for that artifact (the EVALUATE phase checks the artifact against its own DoD, not a generic quality bar).
- Optional: a task prompt — what the ideal result looks like (free text). If absent, the artifact's current state + its owning-skill DoD is the target.
- Optional: success criteria — explicit rules/thresholds. If absent, derived from the artifact type (a spec → zero §8 open questions + every §5 AC testable; a `tasks.json` → acyclic DAG + every `dod` testable + AC coverage; a `sad.md` → all 12 Arc42 sections present + ADR gate closed). Confirmation is always asked (step 2), never inferred silently.
- `.claude/sdd.local.md` — for `judgment_model` (the critic/reviewer tier).

## Persistence contract

State lives in `docs/features/<slug>/.loop/` — created on first run, optional (deleted when a loop completes/stops and the user cleans up):

```
docs/features/<slug>/.loop/current.json          # pointer to the active loop (only while active)
docs/features/<slug>/.loop/<task-alias>/run.json # single source of truth for current loop state
docs/features/<slug>/.loop/<task-alias>/history.jsonl  # append-only event log
docs/features/<slug>/.loop/<task-alias>/artifact.md    # the artifact content (single source — never duplicated in run.json)
```

`run.json` holds state, NOT artifact content. `artifact.md` holds content. `history.jsonl` is append-only. Do not create extra index files unless the user asks. State fully reconstructs from disk after `/clear` (resume reads `run.json` + replays the last `history.jsonl` event).

## Commands

Parse `$ARGUMENTS`:

- `new <artifact> [task prompt]` (or no mode + artifact) — start a new loop
- `resume [alias]` — continue the active loop (or a named one)
- `status` — show active loop state from `current.json`, then STOP
- `stop [reason]` — stop the active loop (`user_stop` if omitted), then STOP
- `list` — list all task aliases + status, then STOP
- `history [alias]` — show event timeline, then STOP
- `clean [alias|--all]` — remove loop files for a stopped/completed/failed loop (user-confirmed), then STOP

`status` / `stop` / `list` / `history` / `clean` are read/control commands — they execute and STOP; they never start an iteration.

## Protocol

1. **Resolve command mode.** If `$ARGUMENTS` is `status`/`stop`/`list`/`history`/`clean` → execute that command from the persistence files and STOP. Otherwise (`new` or bare artifact) → start/resume a loop (step 2).
2. **Initialize or resume.**
   - **New loop:** generate `task_alias` (lowercase-hyphen slug from the artifact + a short topic), `run_id` = `<alias>-<yyyyMMdd-HHmmss>`. Write `current.json` (pointer) + initial `run.json` (status `running`, iteration 1, `max_iterations` default 4, `phase: A`, thresholds A=0.8/B=0.9, empty `plan`/`evaluation`/`critique`). Create `artifact.md` by copying the current artifact content (verbatim — the loop iterates on a working copy, the source artifact is touched only at the end if the user approves).
   - **Resume:** read `run.json` → `current_step` + `iteration`; read last `history.jsonl` event to confirm consistency. Re-execute from the interrupted phase (do not skip). `status: stopped/completed/failed` → inform user, suggest `new`.
3. **Confirm success criteria + limits (new loop only, always explicit).** One `AskUserQuestion` (phrasing per [`../_shared/ask-style.md`](../_shared/ask-style.md)): show the derived rules + thresholds (A=0.8, B=0.9) + `max_iterations` (default 4) + optional completed-phase time budget (default none) + the artifact's owning-skill DoD as the structural floor. User confirms or adjusts. Never start iteration 1 without explicit confirmation — even if the task prompt contained criteria (the prompt is a draft; confirmation is the lock).
4. **Iteration execution (per iteration N):**
   1. **PLAN** (`current_step: PLAN`) — a short plan for this iteration: which sections/rules to focus on, informed by the previous iteration's critique (iteration 1: the whole artifact). One `Task` call or inline; keep it short.
   2. **PRODUCE ‖ PREPARE** (`current_step: PRODUCE_PREPARE`) — launch as two parallel `Task` calls after PLAN completes:
      - **PRODUCE** generates the next artifact revision (writes to `artifact.md`).
      - **PREPARE** generates the check definitions from the rules + the artifact's owning-skill DoD (the structural items EVALUATE will verify). Independent of PRODUCE — both depend only on PLAN.
      - Wait for both. If `Task` is unavailable → sequential fallback (PLAN → PRODUCE → PREPARE → EVALUATE → …); the loop must work without parallelism.
   3. **EVALUATE** (`current_step: EVALUATE`) — **this is where `loop` reuses SDD mechanics instead of inventing its own.** Dispatch the [`critic`](../../agents/critic.md) agent (`subagent_type: "sdd:critic"`; fallback `general-purpose` with the prompt body from [`../_shared/critic.md`](../_shared/critic.md)) — clean context, it Reads `artifact.md` + the upstream artifacts itself, probes against the F1–F6 failure classes + the artifact-specific F6 specialization (the owning-skill DoD). For artifacts the critic wasn't designed for (`api`, `tasks.json`), the F6 specialization comes from the rule-set in [`./references/rule-schema.md`](./references/rule-schema.md) (PREPARE materialized it). Aggregate the critic's findings into a score (passed/failed per rule; score = passed/total). Alternatively spawn parallel `Task` agents for independent check groups (executable checks via Bash, content rules via Read/Grep) when the rule-set has them.
   4. **Check stop conditions** (step 5) BEFORE deciding to refine — if a stop holds, stop with that reason.
   5. **CRITIQUE** (`current_step: CRITIQUE`, only if `passed=false`) — derive precise issue + fix instructions per failed rule. The critic's findings already carry this (cite-mode: every finding cites an artifact location + an upstream/rule location); CRITIQUE formats them into fix instructions for REFINE.
   6. **REFINE** (`current_step: REFINE`, only if `passed=false`) — rewrite `artifact.md` to address the failed rules. **Only what the failed rules require** — no drive-by rewrites (the same discipline `fix` enforces: minimal change, no scope creep). Before overwriting, save a SHA-256 of the previous `artifact.md` in the `refinement_done` event (integrity verification without bloating history).
   7. **Phase A → B transition:** if `phase=A` and `passed=true` → switch to `phase=B` (activate B-level rules, re-run PREPARE + EVALUATE against the same artifact; no PLAN/PRODUCE — the artifact already passed A). If B passes → stop (`threshold_reached`). If B fails → CRITIQUE → REFINE → increment iteration.
   8. **Persist after every phase** (step 6): update `run.json` + append `history.jsonl` event + update `current.json.updated_at` + write `artifact.md` after PRODUCE/REFINE.
5. **Stop conditions (precedence contract — evaluate top-down, first match wins):**
   1. `threshold_reached` — `phase=B` and `passed=true`.
   2. `no_major_issues` — `phase=B` and no `fail`-severity rules failed (only warn/info remain); never fires in phase A.
   3. `user_stop` — explicit user stop.
   4. `stagnation` — `stagnation_count >= 2` (delta = score − last_score; if `delta < 0.02` and no fail-blockers, increment).
   5. `budget_exceeded` — `max_completed_phase_seconds` set and accumulated completed-phase time ≥ it (soft — checked at phase boundaries, never interrupts mid-phase).
   6. `iteration_limit` — `iteration >= max_iterations`.
6. **Persistence writes (every phase).** Update `run.json` (incl. `current_step`); append event to `history.jsonl` (`plan_created`/`artifact_created`/`checks_prepared`/`evaluation_done`/`critique_done`/`refinement_done`/`phase_switched`/`iteration_advanced`/`phase_error`/`stopped`/`failed`); update `current.json.updated_at`; write `artifact.md` after PRODUCE/REFINE. Event payloads carry the score + passed/failed rule ids (compact — never dump the full artifact into the conversation).
7. **Post-loop.** Resolve `artifact_status` (`not_created` / `unevaluated` / `stale` / `evaluated`) BEFORE reporting any numeric score — only `evaluated` may report `final_score`; the others print `final_score: unavailable` + the reason. On `iteration_limit`/`budget_exceeded` with `passed=false` + `evaluated`, include a **distance-to-success** block (threshold, gap, failed rule count + ids, rules progress). Set `run.json.status` per the stop reason (`threshold_reached`/`no_major_issues` → `completed`; `user_stop`/`iteration_limit`/`stagnation`/`budget_exceeded` → `stopped`; `phase_error` → `failed`); delete `current.json` (no active loop remains). Ask the user whether to write `artifact.md` back to the source artifact path (default: yes on `completed`, ask otherwise) — this is the only step that touches the source artifact.
8. **Handoff.** Emit the stage-handoff block per [`../_shared/handoff.md`](../_shared/handoff.md) (utility variant — `/clear` optional): *What I did* (loop alias, iterations run, final score, stop reason, artifact_status) + *Review* (`artifact.md` working copy, `run.json`, `history.jsonl`) + *Run next*: resume the owning skill's flow (e.g. after looping a `spec.md`, resume `clarify` or `design`; after looping `tasks.json`, `refine` or `implement`).

## Definition of Done

- The loop ran ≥1 full iteration (PLAN → PRODUCE → PREPARE → EVALUATE; CRITIQUE/REFINE only if failed) OR stopped cleanly on a non-iteration command.
- EVALUATE actually dispatched the critic (clean context, Read itself) — not skipped, not paraphrased into the main thread.
- `run.json` + `history.jsonl` + `artifact.md` are consistent (state reconstructs from disk).
- The stop reason is one of the six precedence-contract values; `artifact_status` is resolved before any score is reported.
- On `completed`, the user was asked about writing `artifact.md` back to the source.
- The EVALUATE dispatch (clean-context critic) + the persistence consistency are this skill's **structural self-check** ([`../_shared/self-check.md`](../_shared/self-check.md)); its result is reported in the handoff.

## Anti-patterns

- **Using `loop` where the backbone mini-loop suffices.** `specify`/`design`/`tasks` already have Socratic + critic + self-check. `loop` is the escape hatch for when those weren't enough — don't reach for it first.
- **Skipping the criteria confirmation.** Even if the task prompt listed rules, step 3 confirms them explicitly — a silent inferred bar leads to runaway iterations.
- **Dumping the full artifact into the conversation.** The artifact is on disk (`artifact.md`); iteration summaries cite the SHA-256 prefix + changed sections, never the full body.
- **REFINE rewriting more than the failed rules require.** Minimal change — the same discipline `fix` uses. Drive-by rewrites pollute the diff and hide regressions.
- **Inventing an EVALUATE that bypasses `critic.md`.** The critic is the canonical clean-context judge; `loop` dispatches it (with an F6 specialization for non-spec/sad artifacts), it does not build a parallel evaluator.
- **Touching the source artifact mid-loop.** The loop iterates on `artifact.md` (working copy); the source is written only at post-loop step 7, with user approval.
- **Forcing context clears.** Recommend after iteration 2 / on phase transition / at iteration ≥3, but the user decides.
- **A run that never persists.** Every phase writes to disk; a loop that only holds state in conversation is not resumable and is the bug the persistence contract exists to prevent.

## References

- [`./references/phase-contracts.md`](./references/phase-contracts.md) — strict I/O contracts for each of the 6 phases (PLAN/PRODUCE/PREPARE/EVALUATE/CRITIQUE/REFINE).
- [`./references/rule-schema.md`](./references/rule-schema.md) — the rule format (id/description/severity/weight/phase/check) + score calculation + the F6 specialization table for non-spec/sad artifacts.
- [`../_shared/critic.md`](../_shared/critic.md) — the clean-context critic dispatch + F1–F6 skeleton; EVALUATE reuses it, never duplicates.
- [`../_shared/agent-roster.md`](../_shared/agent-roster.md) · [`../_shared/ask-style.md`](../_shared/ask-style.md) · [`../_shared/handoff.md`](../_shared/handoff.md) · [`../_shared/self-check.md`](../_shared/self-check.md).

## Example invocation

> **User:** «/sdd:loop checkout-discounts spec — polish until every AC is testable and zero §8 OQ remain»
> **Skill:** `status`/`list` → none active. `new`: alias `spec-polish`, `run_id` `spec-polish-20260807-130500`. Step 3 confirms: rules = [every §5 AC testable (fail), zero §8 OQ (fail), §6 NFR carry measurement (warn), §1 scope clear (warn)], thresholds A=0.8/B=0.9, max_iterations=4, budget=none → user confirms. Iteration 1: PLAN (focus §5 + §8) → PRODUCE ‖ PREPARE (artifact revision + check defs from specify's DoD) → EVALUATE (critic dispatched, clean context, Reads spec.md + sad.md; score 0.6, 2 fail) → CRITIQUE (3 ACs non-testable, 1 OQ open) → REFINE (rewrite 3 ACs to testable form, resolve the OQ inline) → persist. Iteration 2: EVALUATE score 0.85 → phase A→B. Iteration 3: EVALUATE B score 0.92 ≥ 0.9 → `threshold_reached`, `completed`. Post-loop: `artifact_status=evaluated`, final_score 0.92, ask user → yes, write back to `spec.md`. Handoff → resume `clarify` (skip — zero OQ) → `design`.
