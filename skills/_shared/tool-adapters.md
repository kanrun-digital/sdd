# Tool adapters — running SDD under Codex / Cursor (the cross-tool mapping)

> **Reference-only.** Not a skill. The skills are written against Claude Code's mechanisms
> (`/sdd:<name>` invocation, `AskUserQuestion`, named subagents, `TeamCreate` / `Workflow`,
> `/clear`). SKILL.md is the open Agent Skills format. So Codex and Cursor run the **same
> files unchanged**. `install.sh` copies the repo subtree verbatim. Each Claude-specific mechanism
> maps to the host tool's equivalent per the table below. At install time, every skill name gets an
> `sdd-` prefix. Reason: the bare `review` / `design` / `api` names would collide with generic
> names. The Claude form `/sdd:specify` therefore keeps its mapping: `sdd-specify`.

## TL;DR (українською)

Ті самі SKILL.md працюють у **Codex** та **Cursor** без змін — `install.sh` копіює дерево
дослівно і лише додає префікс `sdd-` до імен (bare-імена `review`/`design`/`api` конфліктували б
із загальними скілами). Кожен Claude-механізм має відповідник: `/sdd:specify` → `$sdd-specify`
(Codex) / вибір `sdd-specify` через `/` (Cursor); `AskUserQuestion` → нумеровані питання плейн
текстом (зупинись і чекай відповіді); субагенти → попроси Codex делегувати встановленому
`sdd-*` агенту за ім'ям (`/agent` лише переглядає/перемикає вже створені треди) або виконай
інструкції інлайн; `TeamCreate`/`Workflow` → нативний subagent workflow Codex із залежностями TDD,
а за відсутності custom agents — built-in агенти з тими самими промптами, потім послідовний floor;
`/clear` → нативний `/clear` у Codex (`/new` теж створює новий чат). Механізм недоступний → **graceful-деградація до інлайн-еквівалента,
ніколи не блокувати стадію**. Дашборд працює скрізь: читання йде з диска й від хоста не залежить,
а спосіб «драйву» обирає `dashboard_drive` (Claude-канал · headless `codex exec` · live-тред
Codex через app-server · копіювання команди в буфер).

---

## The mapping

| Mechanism (as written in the skills) | Claude Code | Codex | Cursor |
|---|---|---|---|
| Invoke a stage | `/sdd:specify <slug>` | script install: `$sdd-specify <slug>`; marketplace: `$specify <slug>` | type `/`, pick `sdd-specify` |
| Ask the user (`AskUserQuestion`) | the native tool | numbered questions in plain text — **stop and wait** for the answer, never assume one | same as Codex |
| Spawn a subagent (`subagent_type: "sdd:researcher"`) | the named plugin agent | ask Codex to delegate to custom agent `sdd-researcher`; use `/agent` only to inspect/switch the spawned thread. If the agent is not installed, use a built-in agent with the same prompt or run the instructions inline | subagent `sdd-researcher` installed into `.cursor/agents/`, or inline |
| `TeamCreate` / `Workflow` (the `implement` engine modes) | native | native Codex subagent workflow: parent orchestrates `sdd-test-author` → `sdd-implementer` → `sdd-reviewer` in dependency order. If custom agents are unavailable, use built-in agents or the sequential single-agent floor | host subagents when available; otherwise the sequential floor |
| Fresh context between stages | `/clear` | `/clear` (or `/new` to keep the old transcript visible) | start a new chat |
| `model:` / `effort:` frontmatter | honored | the script leaves `model` unset so the custom agent follows Codex's spawn/config precedence; it maps `effort:` to pinned `model_reasoning_effort` in `.codex/agents/sdd-*.toml`. A file-pinned effort wins over spawn/default/parent values. Frontmatter in the verbatim documentation copies is not runtime config | generated Cursor agents use `model: inherit`; effort support is host-dependent |
| Shared artifacts (`.size`, `.route`, `spec.md` + the other `docs/features/<slug>/…` files, `.claude/sdd.local.md`) | repo-relative files the **model itself** reads/writes with its file tools | identical — no host involvement, so they work unchanged. `.claude/` is just a directory in the repo here, not a host config dir | same as Codex |

The `CLAUDE_CODE_*` env vars the roster mentions (`CLAUDE_CODE_SUBAGENT_MODEL`,
`CLAUDE_CODE_EFFORT_LEVEL`, `CLAUDE_CODE_FORK_SUBAGENT`) are **Claude Code-only**. Codex and Cursor
ignore them. Codex uses the generated custom-agent TOML plus its `[agents]` config/spawn settings.

The source `tools:` list is not a Codex custom-agent allow-list. The installer maps roles that
declare `Write`/`Edit` to `sandbox_mode = "workspace-write"` and every other role to `read-only`;
the role instructions remain the behavioral boundary. Parent live permission overrides can still
win, so do not deliberately widen a reviewer/critic spawn and then claim it was technically
write-incapable.

Because the generated TOML pins the source effort, a different one-off effort cannot override the
same named custom agent. Use a built-in Codex agent with the role prompt plus an explicit effort,
or a separately configured custom-agent variant. Model overrides remain dynamic because the
installer deliberately leaves `model` unset. Anthropic aliases in `.claude/sdd.local.md` are tier
labels on Codex; never pass `haiku`/`sonnet`/`opus`/`fable` as Codex model IDs.

The Codex marketplace package installs skills but not the generated `.codex/agents/sdd-*.toml`
files: custom agents are a separate local configuration surface, not a plugin resource. Use the
script install for named `sdd-*` agents. With the marketplace path, follow the same prompts through
built-in subagents or the inline fallback.

## The visual dashboard

The dashboard runs on every host. It used to be Claude-only because its one inbound path was
`notifications/claude/channel`. That path is now one driver among four, and the half that
matters most never needed a host at all: the server derives each feature from `docs/` on disk,
so the pipeline view, the artifacts, the diagrams and the `fs.watch` live refresh are identical
under Claude Code, Codex and Cursor.

Only **driving** differs, and `dashboard_drive` in `.claude/sdd.local.md` selects it:

| Host | `auto` resolves to | A click then… |
|---|---|---|
| Claude Code | `claude-channel` | queues `/sdd:<skill> <slug>` into the live session; runs when it is idle |
| Codex (with `codex` on PATH) | `codex-exec` | starts a **headless `codex exec` run** — its own context, its own approvals, streamed into the activity pane. Not your terminal session. |
| Codex, opted in | `codex-appserver` | `turn/start` on the live thread over the app-server control socket. **Experimental** on Codex's side and only reachable once remote control is paired. |
| Cursor, or anything else | `copy` | nothing is delivered — the browser copies `$sdd-<skill> <slug>` to the clipboard and says so |

Two invariants hold across all four. A driver that cannot deliver **degrades to `copy` with the
reason shown**, never a silent no-op. And the command is spelled for the host that will run it:
`/sdd:design <slug>` on Claude, `$sdd-design <slug>` where the installer applied the `sdd-`
prefix.

Install: on Claude Code the plugin's `.mcp.json` declares the server. On Codex/Cursor,
`install.sh` copies `server/` + `dashboard/` next to the skills and **prints** the one-line MCP
registration (`codex mcp add …` / the `.cursor/mcp.json` entry) — registering an MCP server
rewrites host config, so the installer never does it for you.

## The rule

A mechanism can be unavailable in the host tool. In that case, **degrade to the inline sequential
equivalent. Never block the stage** on a missing host feature. The stage-handoff block
([`handoff.md`](./handoff.md)) is still printed in full every run. Only substitute the host's
invocation + fresh-context forms from the table above.
