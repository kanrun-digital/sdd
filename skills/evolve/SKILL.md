---
name: evolve
model: opus
effort: high
agents: []
description: >
  Use to self-improve the SDD skills for the current repo by mining fix-records (_fixes/) and
  review-records (_review/) for recurring prevention points, and writing compact project-specific
  rules to docs/.skill-context/sdd-<skill>/SKILL.md that override each skill's defaults (same priority
  as nested CLAUDE.md). Cursor-based incremental processing — only new fixes/reviews since the last
  run are analyzed (plus a tail-5 overlap window). Triggers on "evolve skills", "learn from fixes",
  "evolve {skill}", "evolve", "навчись з фіксів", "покращ скіли по ревʼю". Never edits the
  built-in skills/sdd-*/SKILL.md (re-install overwrites them) — all improvements land in skill-context.
  Repo-level utility (one .skill-context tree serves the whole repo), like survey/roadmap.
---

# Skill: evolve

The **repo-level learning engine** — turns the SDD pipeline's own byproducts (`_fixes/` records from `fix`, `_review/` records from `review`, `sad.md` §9 Risks, Accepted ADRs) into compact, project-specific rules that **override** the built-in skill defaults. Every bug the pipeline fixes, every review finding it raises, is evidence about where a skill's default wasn't enough for *this* repo. `evolve` aggregates that evidence into rules; the skills read those rules at startup and prioritize them over their own defaults (the same precedence nested `CLAUDE.md` files use — more specific context wins).

It is **orthogonal to the backbone**: not a stage in `survey → … → ship`. Repo-level utility (one `docs/.skill-context/` tree serves every feature), invoked periodically (after 5-10 fixes, after a review cycle, when a pattern recurs). Output is the skill-context files + an evolution log; `evolve` does not commit (the user commits the skill-context + log as a repo-level change).

Evolution-report prose follows `artifact_language`; **skill-context rule files are always written in English** (they are consumed by AI agents across sessions — English ensures consistent interpretation regardless of the repo's artifact language) → [`../_shared/artifact-language.md`](../_shared/artifact-language.md).

## Owner

Tech Lead (they own the repo's engineering conventions). They approve which rules land in skill-context — `evolve` proposes, the Tech Lead disposes. PM is consulted when a rule touches product-side skills (`specify`, `clarify`).

## Inputs

- Optional `<skill>` — evolve only that skill (`fix`, `implement`, `tasks`, …); accepts bare name, `sdd-`-prefixed, or `/sdd-`-prefixed (normalized). If absent or `all` → evolve every installed skill that has new evidence.
- `.claude/sdd.local.md` — for `artifact_language` (report prose) + `judgment_model`.
- `docs/architecture-map.md` — the repo's architecture (tech stack, conventions, migration tooling) — the convention source for tech-stack gaps.
- **Evidence sources (SDD-native, read-only):**
  - `docs/features/*/_fixes/*.md` — fix-records (symptom → root cause → pinning test → spec patch → follow-ups). Each carries a `triage` (regression/spec-bug/gap) + `acs` + the prevention signal.
  - `docs/features/*/_review/review-*.md` — review-records (findings with verdicts Fix/Defer/Not-an-issue + the gate result). Recurring review findings are systemic skill gaps.
  - `docs/features/*/sad.md` §9 Risks + §10 Assumptions — known risks/debts that a skill should heed.
  - `docs/features/*/adr/NNNN-*.md` — Accepted ADRs (architectural constraints a skill must respect).
- `docs/.skill-context/sdd-<skill>/SKILL.md` — the previously-accumulated rules (read for stale-rule detection + gap analysis). Created by `evolve` on first run per skill.
- `docs/.loop/evolve-cursor.json` — incremental processing cursor.

## Critical: never edit built-in skills directly

**NEVER modify any files inside `skills/sdd-*/` (the installed skill directories).** All files there are owned by the SDD install (`install.sh` / the plugin marketplace) and will be **overwritten on the next update** — any direct edit is lost. **ALL improvements go to `docs/.skill-context/sdd-<skill>/SKILL.md`** — the project-owned override target. This is the only correct target for built-in-skill improvements. No exceptions. (Custom skills the user authored outside `sdd-*` may be edited directly — but `evolve`'s default target is always skill-context.)

## Two-layer learning model

1. **Raw evidence** (`_fixes/*.md`, `_review/*.md`, §9/§10, ADRs) — the source material, scoped per feature.
2. **Skill-context rules** (`docs/.skill-context/sdd-<skill>/SKILL.md`) — the compact, reusable output, scoped repo-wide.

`evolve` is the **primary raw-evidence analyzer**. Skills (`tasks`, `implement`, `refine`, …) **prefer skill-context first** at startup; raw evidence is fallback context only (a skill may read a small targeted subset of `_fixes/` when refining around a known recurring issue, but never the full history by default). Force a full re-analysis by resetting the cursor (delete `evolve-cursor.json`) and re-running `evolve`.

## Protocol

1. **Resolve target + load context.**
   - **Normalize skill name:** strip leading `/`; if the arg doesn't start with `sdd-` AND a `sdd-<arg>` skill exists → use `sdd-<arg>`; else use as-is. Verify the resolved skill exists (`skills/sdd-<name>/SKILL.md`); missing → error + STOP («Skill '<name>' not found. Run `/evolve` without args to evolve all, or specify a valid skill.»). `<skill>` absent or `all` → evolve every installed skill with new evidence.
   - **Read `docs/architecture-map.md`** for tech stack + conventions (the convention source for step 5.2/5.3 gaps).
   - **Read skill-context files** for target skills: specific → only that skill's context (+ evolve's own, if the target isn't evolve itself); `all` → `Glob: docs/.skill-context/*/SKILL.md`.
2. **Collect intelligence (cursor-based incremental).**
   - **Glob evidence:** `docs/features/*/_fixes/*.md` + `docs/features/*/_review/*.md`. Sort by path (lexical = chronological given the date-prefixed filenames).
   - **Cursor:** `docs/.loop/evolve-cursor.json` (`{ "last_processed_fix": "<file>", "last_processed_review": "<file>", "updated_at": "<ts>" }`). First run (no cursor) → read all. Cursor present + referenced files exist → read only files `>` the cursor value per type. Cursor present + referenced file missing (deleted/renamed) → `WARN [evolve]` + full rescan of that type.
   - **Overlap window (anti-miss guard):** in incremental mode, ALSO read the newest 5 files per type (tail-5), de-duplicated. Track «New» vs «Overlap» separately — the cursor advances only on «New».
   - **Build a Prevention Point Registry** (per [`./references/prevention-registry.md`](./references/prevention-registry.md)): a flat list of every independent prevention point extracted from the evidence, with its target skill(s). **One fix-record with 3 prevention points = 3 rows**, not 1. A prevention point targeting 2 skills appears once with both listed.
   - **Aggregate patterns:** group by tag/category; identify recurring problems (same tag 3+ times = systemic), tech-specific pitfalls (tied to the stack), missing guards.
   - **Read codebase conventions** from `architecture-map.md` (linter configs, test patterns, error-handling style, logging conventions) — focused on areas relevant to the target skill(s).
   - **Do NOT advance the cursor in step 2.** Cursor updates only after successful apply + log write (step 7).
3. **Read target skills.** Read ONLY the base `skills/sdd-<name>/SKILL.md` for target skills (specific → one; `all` → `Glob: skills/sdd-*/SKILL.md`). Keep in memory for step 5 gap analysis — do not re-read.
4. **Check stale rules in skill-context.** For every target skill that has a skill-context file, compare each rule against the base SKILL.md (loaded step 3): **Case A — base fully covers** (equivalent/superset) → collect for report («Fully covered — recommend removing»); **Case B — conflict** → collect («Conflict — user decision»); **Case C — partial overlap** → collect («Partial overlap — user decision»); **Case D — no overlap** → keep as-is. **Scope constraint:** step 4 only ever modifies skill-context files — it NEVER proposes editing base `skills/sdd-*/`.
5. **Present + resolve stale rules.** If any Case A/B/C: present the stale-rules report (base vs skill-context comparison per rule), collect decisions in batches of ≤3 per `AskUserQuestion` (Keep / Remove / Rewrite). Apply decisions. **Do not proceed to step 6 until all stale decisions are collected** — this determines the actual skill-context state for gap analysis. Skip step 5 if no Case A/B/C.
6. **Analyze gaps.** Re-read skill-context for targets modified in step 5 (do NOT use the step-1 version). A gap exists only if NEITHER base SKILL.md NOR current skill-context covers it:
   - **5.1 Patch-driven (prevention-point-exhaustive).** Iterate the Prevention Point Registry; for each row, for EACH target skill: is this specific prevention action covered by base OR skill-context? Uncovered (prevention_point, skill) pairs → gaps. **Trap:** a `Source: <fix-file>` reference in a rule means ONE rule was derived from that fix — NOT that all prevention points from that fix are covered. Verify content, not filename.
   - **5.2 Tech-stack gaps.** Skills reference generic patterns but the repo uses a specific framework/ORM/test style → add framework-specific guidance.
   - **5.3 Convention gaps.** The repo has a specific error-handling/logging/file-structure pattern skills should enforce → add it.
7. **Generate + present + apply improvements.**
   - **Generate** one rule per gap (one prevention point = one rule; preserve concrete formats/patterns verbatim from the evidence; traceable to a fix/review/ADR/convention; minimal, focused, no generic advice). Quality rules → [`./templates/skill-context.md`](./templates/skill-context.md).
   - **Present** the evolution report (per-skill: target path, N rules, each with Source/Why/Rule). `AskUserQuestion`: Yes-apply-all / Let-me-pick (batches ≤4) / No-just-save-report. **Do not apply until the user answers.**
   - **Apply** approved improvements: `mkdir -p docs/.skill-context/sdd-<skill>`; create or update `SKILL.md` per the template (update existing rule on same topic / add new / merge narrow rules into a broader one); update the `> Last updated:` + `> Based on:` header lines; **NEVER edit `skills/sdd-*/`**; if a skill-context file ends up rule-less (only header), delete it + its dir.
8. **Save evolution log + advance cursor.** Write `docs/.loop/evolutions/<YYYY-MM-DD-HHMM>.md` (intelligence summary + improvements applied + patterns identified). **Cursor update:** new patches processed + improvements applied → advance cursor to newest «New» file per type; new patches + NO improvements applied → do NOT advance by default, ask the user (recommended: keep unchanged to allow reruns); execution failure before finalize → do NOT advance. Append the run to the cursor's history.
9. **Handoff.** Emit the stage-handoff block per [`../_shared/handoff.md`](../_shared/handoff.md) (utility variant — `/clear` optional): *What I did* (skills improved, rules applied, cursor advanced Y/N) + *Review* (the skill-context files, the evolution log) + *Run next*: resume the backbone, or run `review` on recent code to verify the new rules land. Suggest re-running `evolve` after 5-10 more fixes.

## Definition of Done

- The Prevention Point Registry was built (one row per independent prevention point, not per fix) — verifiable from the evidence.
- Stale rules (Case A/B/C) were surfaced + resolved before gap analysis — step 5 completed (or skipped on no stale rules).
- Gap analysis checked each prevention point × each target skill independently (not per-fix).
- Every applied rule is traceable to a fix/review/ADR/convention; no generic advice («write clean code» is not a rule).
- All improvements landed in `docs/.skill-context/sdd-<skill>/SKILL.md` — zero edits to `skills/sdd-*/`.
- The cursor reflects the run accurately (advanced only when new patches + improvements applied).
- The evolution log exists; the skill-context files are written in English.
- The Prevention Point Registry build + the skill-context-only write target are this skill's **structural self-check** ([`../_shared/self-check.md`](../_shared/self-check.md)); its result is reported in the handoff.

## Anti-patterns

- **Editing `skills/sdd-*/SKILL.md` directly.** Re-install overwrites it. All improvements → skill-context, no exceptions.
- **Treating a fix-record as one unit.** A fix with N prevention points produces N rules — extract each independently, targeting the right skill(s).
- **`Source: <fix>` ≠ full coverage.** Finding the filename in a rule's Source means one rule was derived — verify the content covers the specific prevention point.
- **Generic advice.** «Write clean code» / «handle errors» is not a rule — only project-specific enhancements backed by evidence.
- **Advancing the cursor on a no-improvement run.** LLMs miss prevention points on a single pass; keep the cursor to allow reruns unless the user explicitly advances.
- **Rewriting base skills.** `evolve` enriches via skill-context; it does not change a skill's workflow — only its project-specific overrides.
- **Skill-context in non-English.** Rules are consumed by AI agents across sessions; English ensures consistent interpretation regardless of repo language.
- **Losing coverage on merge.** Combining narrow rules into a broader one is allowed only if every prevention point is preserved in the merged rule.

## References & template

- [`./references/prevention-registry.md`](./references/prevention-registry.md) — the Prevention Point Registry format + the per-evidence extraction protocol (fix-record → prevention points; review-record → prevention points).
- [`./templates/skill-context.md`](./templates/skill-context.md) — the skill-context file scaffold (header + rule format) + the evolution-log scaffold.
- [`../_shared/agent-roster.md`](../_shared/agent-roster.md) · [`../_shared/ask-style.md`](../_shared/ask-style.md) · [`../_shared/handoff.md`](../_shared/handoff.md) · [`../_shared/self-check.md`](../_shared/self-check.md).

## Example invocation

> **User:** «/sdd:evolve fix»
> **Skill:** target = `fix`. Reads `docs/architecture-map.md` (stack: Node/Prisma/Jest). Cursor: `last_processed_fix = 2026-07-01-double-discount.md`. Globs `_fixes/*.md` → finds 3 new (post-cursor) + tail-5 overlap. Prevention Point Registry: 5 points (2 from `2026-07-15-null-relation.md` — null-check + check-all-usages; 1 from `2026-07-20-unhandled-promise.md` — async-try-catch; 2 from `2026-08-01-prisma-silent-loss.md` — log-prisma-queries + verify-select-vs-findUnique). Stale rules: none (first run for fix). Gaps: all 5 uncovered (base `fix` SKILL.md has none of these). Report: 5 rules for `docs/.skill-context/sdd-fix/SKILL.md`. User picks «Yes, apply all». Writes skill-context (English); evolution log `2026-08-07-1305.md`. Cursor advanced to `2026-08-01-prisma-silent-loss.md`. Handoff → resume backbone; re-run after 5-10 more fixes.
