# Settings — `.claude/sdd.local.md` (step 2)

A plugin-settings file with YAML frontmatter configures the engine per project. On first run, **lazy-create** it with the defaults below. Tell the user where it is. On later runs, read it.

> **Historical path, host-neutral data.** `.claude/sdd.local.md` predates Codex support, but SDD
> treats it as a repo-relative settings artifact on every host. Codex does not load it as native
> Codex configuration; the active SDD skill reads it and maps relevant values to Codex dispatch.

> **Plugin-wide, not implement-only.** Most keys below configure the `implement` engine. A few keys are read by **other skills too**. The Q&A skills (`specify` / `clarify` / `design`) read `interview_depth` to pre-select the depth dial. **Every artifact-writing skill** reads `artifact_language`. It sets the language that pipeline documents are written in (prose only, structure stays English → [`../../_shared/artifact-language.md`](../../_shared/artifact-language.md)). `tasks` and `refine` read `executor_tier`. It calibrates how much the plan spells out for whoever will execute it (→ [`../../_shared/executor-tier.md`](../../_shared/executor-tier.md)). **Every skill that calls `AskUserQuestion`** reads `conversation_language`. It sets the language of the questions and option text shown to the user — a **separate** concern from the language documents are written in (→ [`../../_shared/ask-style.md`](../../_shared/ask-style.md)). The file is **auto-created with documented defaults the first time any skill needs it**. Normally `specify` does this at the start of the backbone. The rest of the pipeline then finds a real file instead of a silent fallback. If the file is still missing, a reader falls back to its own default (`medium`). There is **no hard ordering dependency** on `implement` having run first.

## Auto-create when absent

The file is created **automatically** the first time a skill needs it. Normally `specify` does this at the start of the backbone (it ensures the file alongside establishing `.size`). `implement` also creates it if you jump straight to it. **Idempotent:** if the file already exists, it is read, never overwritten.

1. If `.claude/sdd.local.md` is absent, write it. Write **the documented frontmatter below, then the «What each key does» section as the file's markdown body**. The file is then self-documenting. Every key carries its default, its allowed values, and a plain explanation inline. The user needs no plugin docs.
2. **Patch `.gitignore`** (create it if absent) to include `.claude/*.local.md` and `.worktrees/`. These files are per-developer and must not be committed. (The `.claude/*.local.md` glob already covers `sdd.local.md`. Do not add a redundant explicit line.)
3. Tell the user: «Wrote `.claude/sdd.local.md` with documented defaults — edit it to change how the pipeline behaves.»

## The documented frontmatter

<!-- This block is written verbatim to the top of `.claude/sdd.local.md`; the «What each key does»
     section below becomes the file's body. Keep the inline comments — they list the allowed values. -->

```yaml
interview_depth: medium    # easy | medium | hard — plugin-wide default for specify/clarify/design (see _shared/interview-depth.md)
artifact_language: en      # en | uk (any language tag) — language pipeline DOCUMENTS are written in; headings + machine tokens stay English (see _shared/artifact-language.md)
conversation_language: uk  # uk | en (any language tag) — language the SKILL TALKS TO YOU in (AskUserQuestion text); independent of artifact_language (see _shared/ask-style.md)
executor_tier: balanced    # cheap | balanced | judgment — capability of whoever EXECUTES the plan; read by tasks/refine to calibrate plan granularity (see _shared/executor-tier.md)
tdd: true                  # enforce red→green→refactor
team_mode: false           # true → agent team (TeamCreate on Claude; native custom subagents on Codex)
workflow_mode: auto        # auto → native Workflow or host subagent-DAG equivalent; off → never
max_parallel_agents: 3     # integer ≥1 — fan-out cap for team/workflow modes (1 = sequential)
isolation: worktree        # worktree | inplace (parallel>1 ⇒ forces worktree)
stop_on_red: true          # halt on a red that survives escalation, vs drop-and-continue
max_red_retries: 3         # integer ≥1 — RED→GREEN attempts before escalation
gate_lint: true            # true | false — include lint in the per-task gate
gate_vet: true             # true | false — include vet / static-analysis in the per-task gate
require_integration: auto  # auto | always | never (Docker-probed)
auto_commit: per_task      # per_task | per_phase | off
branch_strategy: feature   # feature | current
cmd_test_unit: ""          # empty = autodetect (escape hatch)
cmd_test_integration: ""
cmd_lint: ""
cmd_vet: ""
model_test_author: sonnet     # per-role model (see _shared/agent-roster.md); inherit = session model (portable); on a non-Anthropic host, use a full model ID (e.g. gpt-5.6)
model_implementer: sonnet     # same — inherit = session model; full model ID on non-Anthropic hosts
model_reviewer: opus          # same — inherit = session model; full model ID on non-Anthropic hosts
judgment_model: opus          # opus | fable | <full-model-id> — one switch for ALL judgment agents (reviewer/critic/devils-advocate/strategist/analyst); on Codex set a supported Codex model ID (e.g. gpt-5.6); per-role model_<role> wins for its role
effort_test_author: medium    # per-role effort; raised to high on escalation
effort_implementer: medium
effort_reviewer: high
dashboard_enabled: false   # true → opt into the SDD visual dashboard (any host; needs Bun)
dashboard_port: 4178       # integer — loopback port the dashboard binds (scans upward if busy); read by the server
dashboard_drive: auto      # auto | claude | codex-exec | codex-appserver | copy — how a dashboard click reaches an agent
```

## What each key does

- **`interview_depth`** — `easy | medium | hard`. The plugin-wide default for the **Q&A skills'** depth dial (`specify` / `clarify` / `design`). The dial governs how much each skill decides on its own vs. interrogates you: question volume, autonomy, which ideation analyses run, per-diagram confirm vs. proceed. It only **pre-selects** the recommended option in each skill's opening depth question. The user can still override per run. The user can pass `--depth=` to skip the question. It does **not** affect AC-completeness. That floor holds at every level. Full semantics → [`../../_shared/interview-depth.md`](../../_shared/interview-depth.md). (The `implement` engine itself does not read it.)
- **`artifact_language`** — `en | uk` (any language tag; default `en`). The language **pipeline documents** are written in. **Every artifact-writing skill** reads it (spec, SAD, ADRs, sequences, data-model, contracts, tasks, test plan, review/fix records, changelog, roadmap, CONTEXT.md). The `implement` engine does not read it. Only **prose** switches (paragraphs, table cells, diagram labels, the prose fields of `tasks.json` / `openapi.yaml`). **Structure stays English** — section headings verbatim from the template, frontmatter keys+values, verdict literals, tracker states, Mermaid keywords, machine fields. Precedence when editing: an existing file's language wins over the setting. A new file matches its feature-folder neighbours. Never retro-translate. Full rule + the never-translate token list → [`../../_shared/artifact-language.md`](../../_shared/artifact-language.md).
- **`conversation_language`** — `uk | en` (any language tag; default `uk`). The language the pipeline **talks to you in**: the `question` text and the option `label` / `description` of every `AskUserQuestion`, plus the narration around it. **Every skill that asks a question** reads it. The `implement` engine does not. It is **independent of `artifact_language`**: an interview in Ukrainian can produce a spec in English, and the reverse. What never switches with it: technical identifiers (ADR, JSONB, JWT, OpenAPI, file paths, `/sdd:…` commands), the four canonical action semantics, and everything on the never-translate list in [`../../_shared/artifact-language.md`](../../_shared/artifact-language.md) — those are names, not prose. Full phrasing contract (the explanatory rule holds in every language) → [`../../_shared/ask-style.md`](../../_shared/ask-style.md).
- **`executor_tier`** — `cheap | balanced | judgment` (default `balanced`). The capability of whoever will **execute** the plan. Read by `tasks` (the producer) and `refine`. The `implement` engine does not read it — it consumes an already-calibrated `tasks.json`. This is the only dial that describes the **executor**. `.size` describes the feature, `.route` the stages, `interview_depth` the user dialogue. They are orthogonal — never derive one from another. On `cheap` the plan gets finer and more literal: half-day tasks, `files_hint` naming files rather than directories, a named precedent file, numbered steps, no open choices left to the executor, and a DoD that names the verification command. It never inlines upstream prose — precision, not duplication (a copy drifts, a link does not). AC coverage and the DAG are identical at every tier. Full semantics → [`../../_shared/executor-tier.md`](../../_shared/executor-tier.md).
- **`tdd`** — when false, RED is skipped. The engine writes code directly and warns. You lose the safety net.
- **`team_mode` / `workflow_mode`** — these keys feed the decision tree (see [`decision-tree.md`](./decision-tree.md)). `team_mode` wins when both could apply. Claude uses `TeamCreate` / `Workflow`; Codex maps both logical modes to native subagent orchestration over the same dependency DAG.
- **`max_parallel_agents`** — the fan-out cap for team/workflow modes. `1` forces sequential.
- **`isolation`** — `worktree` gives each parallel agent its own git worktree under `.worktrees/`. `inplace` edits the checkout directly and **forces parallelism to 1**.
- **`stop_on_red`** — `true`: a red that survives escalation halts the run. `false`: drop that task, auto-block its dependents, and continue other branches.
- **`max_red_retries`** — RED→GREEN attempts before escalation (see [`escalation.md`](./escalation.md)).
- **`gate_lint` / `gate_vet`** — include lint / vet in the per-task gate. The gate skips them gracefully if no command is detected (see [`command-detection.md`](./command-detection.md)).
- **`require_integration`** — `auto`: run integration tests if a Docker daemon answers, else mark NON-red. `always`: BLOCK before dispatch if Docker is absent. `never`: skip the integration tier entirely.
- **`auto_commit`** — `per_task` (default), `per_phase`, or `off` (leave commits to the user).
- **`branch_strategy`** — `feature`: ensure work is on a feature branch (create one if on the default branch). `current`: commit on the current branch.
- **`cmd_*`** — explicit command overrides. Non-empty values short-circuit detection. This route is the escape hatch for unusual repos.
- **`dashboard_enabled`** — `true | false` (default `false`). Opt into the **SDD visual dashboard** on any host. Its `sdd-dashboard` MCP server binds a loopback HTTP+WS listener and serves the read-only browser UI. Reading is host-independent — the server derives every feature from `docs/` on disk, so the pipeline view, the artifacts and the `fs.watch` refresh work the same under Claude Code, Codex and Cursor. What differs is *driving*, which `dashboard_drive` governs. The markdown skills are unaffected either way. Run `start` after enabling, and install Bun. On Claude Code the MCP server is declared by the plugin's `.mcp.json`; on Codex/Cursor `install.sh` prints the one-line registration command. (The `implement` engine does not read it. The dashboard server + the `start` skill read it.)
- **`dashboard_port`** — integer (default `4178`). The loopback port the dashboard binds. If busy, the server scans upward (`4178..4189`). `/sdd:start` prints the actual port. The server binds only `127.0.0.1`. Mutating routes require the per-session capability token issued by `/sdd:start`.
- **`dashboard_drive`** — `auto | claude | codex-exec | codex-appserver | copy` (default `auto`). How a click in the panel reaches an agent. `auto` picks by host: Claude Code → the MCP channel into your live session; otherwise a `codex` binary → a headless `codex exec` run per command; else `copy`. `codex-appserver` drives the *live* Codex thread over its app-server control socket (`turn/start`) — experimental on Codex's side and only reachable once remote control is paired. `copy` delivers nothing: the browser puts the command on your clipboard. **Every driver degrades to `copy` with a stated reason rather than dropping a click** — a button that quietly does nothing is worse than one that hands you the command. The command is spelled for the host: `/sdd:design <slug>` on Claude, `$sdd-design <slug>` on Codex/Cursor.
- **`model_*` / `effort_*`** — per-role model + effort for the three agents. On Claude the engine uses the Agent call/env mapping. On Codex the generated `sdd-*` TOML leaves `model` unset, so a supported full model ID can be passed explicitly. Its source effort is pinned as `model_reasoning_effort`, and Codex gives that file value precedence over an explicit spawn. If `effort_*` requests a different value, use a built-in agent with the same role prompt plus the explicit effort, or a separately configured custom-agent variant; never claim the pinned named agent was overridden. Roster defaults + rationale → [`../../_shared/agent-roster.md`](../../_shared/agent-roster.md).
- **`judgment_model`** — `opus | fable | <full-model-id>` (default `opus`). One switch for **all judgment agents** — `reviewer` / `critic` / `devils-advocate` / `strategist` / `analyst`. The judgment tier can then be raised in one place (to `fable`, the Mythos tier, or to a full model ID). You do not touch `agents/*.md` (their frontmatter is `model: inherit`). On Codex, treat Anthropic aliases as portable tier labels and leave the model unset; pass a model only when this is a full ID supported by the active build (for example `gpt-5.6`). A per-role `model_<role>` key still wins for its role. Host-specific precedence is defined in [`../../_shared/agent-roster.md`](../../_shared/agent-roster.md). Execution agents (`test-author` / `implementer`) and `explorer` / `researcher` are unaffected.
  - **Env path (Claude only):** the engine exports `CLAUDE_CODE_EFFORT_LEVEL` / `CLAUDE_CODE_SUBAGENT_MODEL` for Claude dispatch. Codex ignores those variables and uses explicit spawn/custom-agent config instead (see [`agent-roster.md`](../../_shared/agent-roster.md)).
  - **`.size` scaling:** the engine raises the default effort for **L/XL** features (execution agents → `high`) before dispatch. It keeps the cheap defaults for **XS/S**. On Codex, a different scaled effort requires the built-in/variant route above because a named custom agent's TOML value wins. Reasoning depth pays off most on a cross-module change. It prints the actually resolved per-role model+effort in the banner.

## Reading semantics

Unknown keys are ignored (forward-compatible). A missing key falls back to the default above. A malformed file → warn and fall back to all-defaults. Do not fail the run.
