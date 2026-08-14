---
name: survey
model: inherit
effort: medium
agents: [explorer]
description: >
  Use to establish the repo's architecture map. The rest of the pipeline reads this map. The
  skill has two modes. On an EXISTING codebase it scans once and persists what is there. On
  an EMPTY or greenfield repo it runs a short, level-adaptive foundation session. That
  session picks the stack / folder structure / data approach / conventions WITH you. It is
  defaults-heavy. It fixes these choices as the foundation + foundational ADRs. It emits a
  scaffold tasks.json. The implement stage materializes that file into a real skeleton.
  Triggers on "survey the codebase", "map the architecture", "set up a new project",
  "bootstrap the foundation", "survey", "вивчи кодову базу", "карта архітектури", "новий
  проєкт", "заклади фундамент". Output: docs/architecture-map.md (+ adr/ + scaffold
  tasks.json on greenfield). The skill records reflects_commit for staleness. It reads an
  authored architecture doc. It never overwrites it.
---

# Skill: survey

The pipeline's anchor on architecture. It produces `docs/architecture-map.md`. This map is the single source of "what the system is". `specify` (constraints), `design` (matches against it), `data-model`, and `implement` read the map instead of re-discovering the code. The skill auto-detects one of **two modes**:

- **Brownfield** (the repo has source) → scan it once. Persist the **current** architecture.
- **Greenfield** (empty / near-empty repo) → run a short, **level-adaptive foundation session**. Pick the stack / structure / data approach / conventions *with* the user (defaults-heavy). Fix them as the **foundation** + foundational ADRs. Emit a **scaffold `tasks.json`**. `implement` turns that file into a real skeleton. Greenfield detail → [`./references/foundation.md`](./references/foundation.md).

Repo-level utility — one map serves every feature. The scan is delegated to [`explorer`](../../agents/explorer.md). Question phrasing → [`../_shared/ask-style.md`](../_shared/ask-style.md). Depth → [`../_shared/size-matrix.md`](../_shared/size-matrix.md).

Map prose follows `artifact_language`. Carry the language in the explorer's dispatch prompt. Frontmatter keys like `test_cmd` / `reflects_commit` stay machine-form. Module/file names stay as-is → [`../_shared/artifact-language.md`](../_shared/artifact-language.md).

## Owner

Architect / Tech Lead — they own the architecture. Brownfield: check it reflects reality. Greenfield: decide the foundation.

## Inputs

- (Optional) a path/scope hint (default: repo root).
- (Read, never overwrite) an authored architecture doc if present (`docs/architecture.md`, `ARCHITECTURE.md`, root `CLAUDE.md`, ADRs). It is a strong input. The map reconciles with it, never clobbers it.
- (Optional, project-level override) `docs/.skill-context/sdd-survey/SKILL.md`. If it exists, read it and treat its rules as project-level overrides. On conflict they win. Apply them to all outputs → [`../_shared/skill-context.md`](../_shared/skill-context.md). If absent, do nothing (defaults apply).

## Protocol

1. **Detect mode + freshness (incremental re-survey on stale).** If `docs/architecture-map.md` exists and is fresh (its `reflects_commit` ≈ current HEAD), ask «map is fresh (reflects `<commit>`). Reuse or refresh?». STOP on reuse. If it exists but is **stale**, prefer the **incremental re-survey**. Run `git diff --name-only <reflects_commit>..HEAD`. Group the changed paths by top-level module. Dispatch the step-3 explorer **scoped only to the changed subfolders**. Update just the touched map rows/sections (module inventory, conventions, frontend, machine keys). Re-stamp `updated_at` + `reflects_commit`. Fall back to the **full re-scan only when the diff spans more than half the modules** in the inventory (or `reflects_commit` no longer resolves). Say which mode ran in the handoff. No map at all → decide the mode. **Brownfield** if the repo has source (modules/packages beyond config). Else **greenfield** (empty or only scaffolding like a bare `go.mod` / `package.json`).

### Brownfield path (existing code)

2. **Read authored docs first.** Any hand-maintained architecture doc / root `CLAUDE.md` / ADRs is authoritative input. Reconcile with it. Never overwrite it.
3. **Scan via explorer.** Dispatch the [`explorer`](../../agents/explorer.md) agent — `subagent_type: "sdd:explorer"` (`haiku`/`low`, clean-isolated per [`../_shared/agent-roster.md`](../_shared/agent-roster.md)): «Report (a) language + frameworks + versions, (b) top-level module layout + per-module layers, (c) layering / wiring conventions, (d) datastores + access, (e) inter-module comms, (f) cross-cutting conventions (errors, IDs, tests, migrations) with one cited example each, (g) 2–3 representative features as precedents, (h) **if a frontend exists** — the component library / design system, design tokens (colors/spacing/typography), styling approach (Tailwind / CSS-modules / styled-components / …), shared UI primitives, and a representative screen/component as the UI precedent to reuse.» For a large repo, dispatch one explorer per subtree. (Fallback `subagent_type: "Explore"`.) Item (h) is the **reuse invariant's source**. The §Frontend / UI foundation section it fills is what `design` / `tasks` / `implement` later **compose against instead of reinventing**. New UI work reuses these components / tokens / the single styling approach. `review` flags from-scratch UI that duplicates them. An incomplete inventory here silently licenses a second design system downstream.
4. **Synthesize + stamp + check + write.** Fill [`./templates/architecture-map.md`](./templates/architecture-map.md) (C4 of what exists, module inventory, cited conventions, datastores, **the Frontend / UI foundation if a frontend exists**, precedent guide, constraints) with real `file:line` anchors. **Fill the machine-readable frontmatter keys** (`language`, `build_cmd`, `test_cmd`, `lint_cmd`, `migration_tool`, `frontend`) from the explorer's findings. A key with no evidence stays `""` (unknown), **never a guess**. `implement`'s command-detection cascade reads `test_cmd`/`lint_cmd` from here. Record `updated_at` + `reflects_commit: <short HEAD>`. **Check the C4 Mermaid per [`../_shared/mermaid-check.md`](../_shared/mermaid-check.md)** (render-parse with `mmdc` if available, else the structural lint — fix before committing). Then run the **structural self-check** (per [`../_shared/self-check.md`](../_shared/self-check.md)) — re-read the map from disk and check: (1) every machine key holds an explorer-backed value or the explicit `""`. (2) Every convention line cites a file that exists. (3) The C4 passed the check. (4) `reflects_commit` = current short HEAD. Write + commit `survey: architecture map (reflects <commit>)`. Then **emit the stage-handoff block** per [`../_shared/handoff.md`](../_shared/handoff.md) — *What I did* + *Review* (`docs/architecture-map.md`, + scaffold `tasks.json` on greenfield) + *Run next* (`/clear`, then `/sdd:specify <slug>`).

### Greenfield path (empty repo) → [`./references/foundation.md`](./references/foundation.md)

G2. **Calibrate to the person.** Ask one opening `AskUserQuestion`. Gauge how the user wants to engage — «pick good defaults, I'll confirm» / «walk me through each choice with explanations» / «let me choose each piece, keep it terse». This sets the dialogue's depth + phrasing. Junior → defaults + glossed explanations per [`../_shared/ask-style.md`](../_shared/ask-style.md). Senior → terser, more control. Not a product brief.
G3. **Intent (short).** Ask 1–3 questions: what the project is + the kind of capabilities it will have (e.g. «HTTP API» / «CLI» / «web app»). This is enough to choose an architecture. It is deliberately NOT the feature briefing (that's `specify`, per feature).
G4. **Pick the foundation, defaults-heavy.** At the calibrated depth, choose: stack (language/framework/datastore), architectural style (e.g. hexagonal modules), folder/module structure, data/persistence approach (migration tool, ID strategy), core conventions (errors, tests, CI). Recommend a coherent default set. The user confirms or adjusts. Choice menus + defaults → [`./references/foundation.md`](./references/foundation.md).
G5. **Fix the foundation.** Write `docs/architecture-map.md` as the **established foundation**. Mark `mode: greenfield-bootstrap`. The C4 is the *target* baseline. Spawn **foundational ADRs** in `docs/adr/` for the irreversible picks (stack, module style, persistence). **Fill the machine-readable frontmatter keys** from the chosen foundation (`language`, `build_cmd`, `test_cmd`, `lint_cmd`, `migration_tool`, `frontend`) — here they encode the *decided* toolchain. Anything not yet decided stays `""`. Record `reflects_commit`. **Check the C4 Mermaid per [`../_shared/mermaid-check.md`](../_shared/mermaid-check.md)** before committing. Run the same step-4 structural self-check.
G6. **Emit the scaffold + hand off.** Write a scaffold `tasks.json` (the skeleton: folder/module structure, a baseline module, the test harness, migration tooling, CI, a `CLAUDE.md`/rules doc) per the contract in [`./references/foundation.md`](./references/foundation.md). Each task's DoD anchors on the **skeleton smoke test** — «the project builds + boots + the empty test suite runs + the migration tool runs». Propose: «foundation fixed — run `implement` to materialize the skeleton» (the wave-of-the-hand hand-off). Commit `survey: greenfield foundation + scaffold plan`.

## Definition of Done

- `docs/architecture-map.md` exists with `updated_at` + `reflects_commit`. An authored doc (if any) was reconciled, never overwritten.
- **Brownfield:** C4 of what exists + module inventory + cited conventions + precedent guide, real anchors (no placeholders).
- **Greenfield:** foundation fixed (stack/structure/data/conventions) at the user's calibrated level + foundational ADRs + a scaffold `tasks.json` whose tasks carry the skeleton smoke-test DoD, ready for `implement`.
- The step-4 **structural self-check** passed ([`../_shared/self-check.md`](../_shared/self-check.md)): machine keys explorer-backed or explicitly `""`, convention citations resolve, C4 checked, `reflects_commit` current. Its result is reported in the handoff.

## Anti-patterns

- **Re-scanning the repo in every downstream skill** — the point is to scan once. Others read the map (drift detection is the only re-read, of real domain files).
- **Overwriting a hand-maintained `docs/architecture.md`** — survey writes its own map and reconciles.
- **A map with no `reflects_commit`** — it silently rots. Nobody knows it's stale.
- **Greenfield: a full product brief.** The foundation session picks the *architecture*, not the features — the idea/briefing is `specify`'s job, per feature. Keep it to intent + foundation choices.
- **Greenfield: ignoring the person's level.** A junior gets defaults + plain-language explanations. A senior gets control + terseness. One calibration question sets this — don't fire a senior-level wall of choices at a first-timer.
- **Placeholders / guessed layout** — cited or `UNKNOWN`. A fictional map is worse than none.

## References & template

- [`./references/foundation.md`](./references/foundation.md) — greenfield: the calibration question, level-adaptive depth, the stack/structure/convention choice menus + defaults, foundational-ADR list, and the scaffold `tasks.json` contract.
- [`./templates/architecture-map.md`](./templates/architecture-map.md) — output scaffold (same file for current OR foundation — a `mode:` marker distinguishes).
- [`../_shared/agent-roster.md`](../_shared/agent-roster.md) — the explorer contract.
