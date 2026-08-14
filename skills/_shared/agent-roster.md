# Agent roster — model / effort policy + the shared agent contract

> **Reference-only.** Not a skill. Skills and the implement engine read this for the model/effort
> matrix, the override precedence, and the contract every spawned agent follows. The canonical
> agent definitions live in `agents/*.md`. This file is the policy that ties them together.

## TL;DR (українською)

Хто яку модель отримує — вирішує **тип роботи**, не смак. Судження (спека, дизайн, рев'ю,
критика, стратегія) → найсильніша модель (`opus`, effort `high`); виконання (тести, код) →
збалансована (`sonnet`, `medium` з ескалацією до `high`); пошук/скан → найдешевша (`haiku`,
`low`). Для Claude прецеденс: env > invocation > settings > frontmatter > session. Для Codex
значення, зафіксоване в TOML агента, найвище; далі spawn > `[agents]` > parent. На L/XL-фічах критичні верифікації (reviewer у `review`, critic у `design`/`specify`)
піднімаються до effort `xhigh`. Для незалежних ролей **чистий контекст** є явною політикою
диспетчеризації, а не автоматичною гарантією кожного хоста: у Codex не успадковуй історію
батьківського чату. Агент сам читає входи з диска і повертає лише **цитовані** знахідки.

---

## The roster (model + effort by role)

The **kind of work** chooses the model, not taste. Judgment gets the strongest model. Execution
gets a balanced one. Search/scan gets the cheapest. Effort is the reasoning depth that the role
needs.

The `model` column uses **portable tier-labels** (`cheap` / `balanced` / `judgment`) so the policy
is host-agnostic. On Anthropic hosts the mapping is: `cheap` → `haiku`, `balanced` → `sonnet`,
`judgment` → `opus` (or `fable` for the Mythos tier). On non-Anthropic hosts (Kimi / GLM /
ChatGPT / Codex / Cursor), the host's own model settings resolve each tier. The agent frontmatter
is `model: inherit` (the session model). The tier is picked via `judgment_model` / `model_<role>`
(see below) or the host config.

| Agent | Kind of work | `model` (tier) | `effort` | Tools |
|---|---|---|---|---|
| `explorer` | brownfield scan / search (read-only) | `cheap` | `low` | Read, Grep, Glob, Bash |
| `test-author` | write the failing test (execution) | `balanced` | `medium` → `high` on escalation | + Write, Edit |
| `implementer` | green + refactor + gate (execution) | `balanced` | `medium` → `high` on escalation | + Write, Edit |
| `reviewer` | independent review (judgment) | `judgment` | `high` | Read, Grep, Glob, Bash |
| `critic` | coherence critique (judgment) | `judgment` | `high` | Read, Grep, Glob |
| `devils-advocate` | ambiguity hunt (judgment) | `judgment` | `high` | Read, Grep, Glob |
| `researcher` | competitive / adjacent-solution research (ideation) | `balanced` | `medium` | Read, Grep, Glob, WebSearch, WebFetch |
| `strategist` | generate the 3 strategic approaches (judgment) | `judgment` | `high` | Read, Grep, Glob |
| `analyst` | multi-perspective review of approaches (judgment) | `judgment` | `high` | Read, Grep, Glob |

Rationale: judgment quality (review, critique, ambiguity, strategy, multi-perspective synthesis)
is where a stronger model pays off. Execution (write code/tests to a clear spec) is well served by
a balanced model. It escalates only when it gets stuck. A read-only scan is cheap. The **ideation
trio** (`specify` step 3, gated by the depth dial) follows the same logic. `researcher` is
gathering-and-citing work (balanced model + web tools). `strategist` and `analyst` are judgment
(generating real alternatives, synthesizing across lenses). They get the strongest model. Treat
model-by-role as a sound principle. The headline "stronger orchestrator + cheaper workers wins by
X%" claim from the multi-agent literature did not survive verification. So we lean on role-fit,
not a magic ratio.

## Dispatching (`subagent_type`)

These agents are **plugin-namespaced**. Spawn each with `subagent_type: "sdd:<name>"`. That is
the id Claude Code registers and shows in the available-agents list. Do **not** use the bare name.
Do **not** use an `sdd-…` prefix:

`sdd:explorer` · `sdd:test-author` · `sdd:implementer` · `sdd:reviewer` · `sdd:critic` · `sdd:devils-advocate` · `sdd:researcher` · `sdd:strategist` · `sdd:analyst`

So when a skill says «dispatch the `explorer` agent», the call is `subagent_type: "sdd:explorer"`.
The namespaced agent may be unavailable at runtime. Then use the general-purpose (or `Explore`)
agent that the skill names, with the same prompt. A fallback agent never reads `agents/*.md`.
Everything it must know arrives in the prompt. Include the **async report-delivery instruction**
(shared-contract point 2 below) when the host runs it in background/teammate mode.

### Cross-tool dispatch

The `subagent_type: "sdd:<name>"` form is **Claude Code-only**. It is the id the plugin loader
registers. Under **Codex / Cursor** the installer generates a custom agent named `sdd-<name>`
(into `.codex/agents/` / `.cursor/agents/`). Ask the host to delegate to that named agent. In
Codex, `/agent` only inspects or switches an already spawned agent thread; it is not a spawn
command. When the host has no custom-agent mechanism in reach, use a built-in agent with the same
prompt or run the agent file's instructions **inline** in the current context. Same
degrade-don't-block rule and the full mapping table: [`tool-adapters.md`](./tool-adapters.md).

Codex custom-agent TOML has no source-style `tools:` allow-list. `install.sh` maps agents that
declare `Write`/`Edit` to `sandbox_mode = "workspace-write"` and every other agent to `read-only`;
the instructions remain a behavioral boundary. A parent session's live permission override can
still supersede an agent-file sandbox. Do not deliberately broaden a judgment agent and then claim
it was technically unable to write.

## Override precedence (highest wins)

Claude Code and Codex resolve runtime configuration differently. Do not treat the Claude env chain
as a Codex configuration contract.

**Claude Code:**

```
env var  >  per-invocation (the Agent call)  >  model_<role>  >  judgment_model  >  frontmatter  >  session
```

**Codex:** a value pinned in `.codex/agents/<agent>.toml` wins. Otherwise an explicit spawn value
wins, then `[agents].default_subagent_model` / `default_subagent_reasoning_effort`, then the parent
session value. The installer leaves `model` unset and maps the source `effort:` to
`model_reasoning_effort`, so the SDD effort baseline is preserved while model choice remains under
Codex/session control. A skill may pass a size- or role-specific **model** override explicitly.
It cannot override the same named agent's pinned effort. When a requested effort differs from that
baseline, dispatch a built-in agent with the same role prompt plus an explicit effort, or use a
separately configured custom-agent variant. Never report a file-pinned value as overridden.
Project `.claude/sdd.local.md` remains an SDD artifact that the skill reads; Codex does not load it
as native host configuration.

On Codex, treat `haiku` / `sonnet` / `opus` / `fable` values from that historical settings file as
portable tier labels, not model IDs. Do not pass them to the spawn API. Leave the model unset so
Codex inherits/resolves it, unless the user configured a full model ID supported by the active
Codex build.

**`judgment_model`** (`.claude/sdd.local.md`, default `opus`) is the one-switch
tier for the **judgment agents** — `reviewer` / `critic` / `devils-advocate` / `strategist` /
`analyst`. Accepts: an Anthropic alias (`opus` — the default, `fable` for the Mythos tier) **or a
full model ID** (`claude-opus-5`, `gpt-5.6`, …). On a non-Anthropic host, set
it to that host's judgment-tier model. Setting it raises all five without touching `agents/*.md`
(their frontmatter is `model: inherit` — the session model). A per-role `model_<role>` key still
wins for its role. It never applies to execution (`test-author` / `implementer`) or
gathering (`explorer` / `researcher`) roles. See the settings doc:
[`../implement/references/settings.md`](../implement/references/settings.md).

- **`model`** env: `CLAUDE_CODE_SUBAGENT_MODEL`. Values: `haiku|sonnet|opus|fable|inherit|<full-model-id>` (Claude accepts a full model ID; non-Claude hosts ignore this variable).
- **`effort`** env: `CLAUDE_CODE_EFFORT_LEVEL`. Values: `low|medium|high|xhigh|max|<number>` (`xhigh`/`max` only on Opus 4.8 / 4.7).
- The `CLAUDE_CODE_*` env vars are **Claude Code-only** levers. Codex / Cursor ignore them.
  In Codex, use the custom-agent TOML, `[agents]` defaults, or an explicit spawn override subject
  to the file-pinned precedence above.
- Per-project overrides live in `.claude/sdd.local.md` as `model_<role>` / `effort_<role>` keys
  (see the implement settings). On a non-Anthropic host, set `model_<role>` or `judgment_model`
  to a **full model ID** (e.g. `gpt-5.6` in current Codex builds). The Anthropic aliases
  (`haiku`/`sonnet`/`opus`/`fable`) are Anthropic-only.

> **Caveat (verify on your build).** Some Claude Code builds report the `effort:` *frontmatter*
> with no observable runtime effect (GitHub claude-code#43083). The field is documented and we
> set it. But treat the **env path** (`CLAUDE_CODE_EFFORT_LEVEL`) as the reliable lever. The
> per-role `effort_*` settings keys map to it. If a run feels under-reasoned, set the env var.

## Scale with feature size

Default effort/model scale with the feature `.size` (see [`size-matrix.md`](./size-matrix.md)):

- **XS/S** → keep the roster defaults (cheap — the work is small).
- **M** → roster defaults. Escalation handles the hard tasks.
- **L/XL** → bump execution effort to `high`. **The critical verifications go to `xhigh`**. The
  `reviewer` (dispatched by `review`) and the `critic` (dispatched by `design` / `specify`) run
  at `effort: xhigh`. Claude uses `CLAUDE_CODE_EFFORT_LEVEL` (the reliable lever — see the caveat
  above). On Codex, do not select the pinned-`high` `sdd-reviewer`/`sdd-critic` and pretend an
  explicit `xhigh` won; use a built-in agent with the same role prompt plus explicit `xhigh`, or a
  separately configured variant. The other judgment agents stay `high`. A cross-module change is
  where reasoning depth pays off. The final review/critique is where it pays off most.

A skill/engine that knows the size applies this before dispatch and says so in its banner.

## The shared agent contract (every spawned agent)

1. **Clean, isolated context is a dispatch requirement for independent roles, not a universal host
   default.** A host may inherit the parent conversation when it spawns an agent. For `reviewer`,
   `critic`, and `devils-advocate`, explicitly request a clean/no-history spawn when the host exposes
   that option (in Codex, use a no-inherited-turns spawn). Do not fork the parent conversation into
   those roles. The dispatching skill must inline paths, the draft/diff, and decisions explicitly.
   The agent re-reads upstream artifacts itself and its final message is the deliverable. This
   isolation is what gives independent review/critique fresh eyes.
   - **Fork mode** (`CLAUDE_CODE_FORK_SUBAGENT`, experimental) inherits the full conversation +
     shares the prompt cache. Use it **only** for a live side-task that genuinely needs the
     running context. Never use it for `reviewer` / `critic` / `devils-advocate`. Their value is
     independence.
2. **The report must reach the dispatcher.** The final message IS the deliverable. The host may
   run subagents asynchronously (background/teammate mode). The dispatching skill then appends to
   the prompt: «also send your full final report as a message to your dispatcher (main)». An
   idle/completion signal without content is NOT a verdict. The dispatcher pulls the report
   through the host's messaging channel before it proceeds.
3. **Worker preamble.** When an orchestrator (the implement team/workflow) delegates, it wraps
   the task: «execute directly, do not spawn sub-agents, use tools directly, report results with
   absolute file paths». Some hosts, including current Codex builds, support nested delegation;
   SDD workers deliberately must not use it. The lead owns fan-out so TDD dependencies and file
   ownership remain explicit.
4. **Verify before claiming done.** Before saying "done / fixed / passing": IDENTIFY the command
   that proves it → RUN it → READ the output → only then claim, with the evidence. Words like
   "should / probably / seems" are a red flag that verification hasn't run.
5. **Cite or drop.** Read-only judgment agents (reviewer/critic/devil's-advocate) emit only cited
   findings (`file:line` + the artifact/AC clause). An uncited finding is dropped, not shipped.
