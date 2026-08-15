---
name: start
model: inherit
effort: low
agents: []
description: >
  Use to open the SDD visual dashboard. The dashboard is a local read-only browser UI. It
  shows every feature's pipeline stage. It renders the artifacts (markdown, mermaid
  C4/sequence/ER, OpenAPI as plain YAML). It drives the pipeline. It sends /sdd:<skill>
  commands back into this live session. Triggers on "start the dashboard", "open the SDD
  dashboard", "sdd dashboard", "/sdd:start", "show the pipeline UI", "відкрий дашборд",
  "запусти панель SDD". The sdd-dashboard MCP server auto-starts at session open via .mcp.json.
  It resolves the project from CLAUDE_PROJECT_DIR. It binds its loopback HTTP listener. It
  writes the dashboard URL to ~/.claude/sdd-dashboard/current.url. The URL carries a capability
  token for this session. So start only READs that file and prints the URL. The common path
  makes no MCP tool call and no channel round-trip. Opt-in: the skill requires
  dashboard_enabled: true in .claude/sdd.local.md. It also requires Bun installed. If either
  is missing, it prints guidance and exits cleanly. Runs on any host: reading is host-independent,
  and how a click drives an agent is chosen by dashboard_drive (Claude channel / headless codex exec
  / Codex live thread / copy-to-clipboard). Pure-markdown skills are unaffected.
---

# Skill: start

Opens the **SDD visual dashboard**. It is a local, loopback-only browser UI. The `sdd-dashboard` MCP server (Bun + `Bun.serve()`) serves it, embedded in the same process that holds this session's MCP channel. The dashboard reads `docs/features/` from disk and renders every artifact. It also **drives the pipeline back into this session** — the point of it. A click in the browser sends a validated `/sdd:<skill> <slug>` command to the host's **driver**. Progress streams back to the browser live.

> **Every host, two halves.** Reading is host-independent — the server derives each feature from
> `docs/` on disk. Driving is not, so it sits behind a driver selected by `dashboard_drive`:
> the Claude channel into this session, a headless `codex exec` run, the live Codex thread over
> its app-server socket, or `copy` (the browser hands you the command; nothing runs). A driver
> that cannot deliver degrades to `copy` **with the reason shown** — never a silent no-op.
> Report the active driver so the user knows which of those a click will do.

`start` is **not** "start the server". The server auto-starts when the session opens (declared in `.mcp.json`). On boot it resolves the project from `CLAUDE_PROJECT_DIR`. It binds the HTTP listener. It **writes the dashboard URL to `~/.claude/sdd-dashboard/current.url`**. So on the common path `start` just **reads that file and prints the URL**. That is a plain file read — no MCP tool, no channel message.

## Owner

The developer running the session. No artifact is produced — this is a connection skill.

## Inputs

- `.claude/sdd.local.md` — read `dashboard_enabled` (must be `true`). Auto-created with documented defaults by `specify`/`implement` → [`../implement/references/settings.md`](../implement/references/settings.md).
- `~/.claude/sdd-dashboard/current.url` — the file the server writes when it binds. Line 1 is the dashboard URL (with the capability token). Line 2 is the resolved project dir. **This is the primary input** — present whenever the server bound HTTP at boot.
- (Fallback only) the `sdd-dashboard` MCP server's `dashboard_handshake` tool — used **only** when the
  URL file is absent (the server could not resolve the project at boot, e.g. `CLAUDE_PROJECT_DIR` unset).
- (Optional, project-level override) `docs/.skill-context/sdd-start/SKILL.md` — if it exists, read it and apply its rules to all outputs. On conflict, the overrides win → [`../_shared/skill-context.md`](../_shared/skill-context.md). Absent → no-op (defaults apply).

## Protocol

0. **Confirm the server is registered on this host.** Claude Code declares it in the plugin's
   `.mcp.json` — nothing to do. On Codex/Cursor it is registered by hand: if no `sdd-dashboard`
   MCP server is configured and `~/.claude/sdd-dashboard/current.url` is absent, print the
   registration line `install.sh` prints (`codex mcp add sdd-dashboard -- bun run --cwd
   <skills-root>/sdd/server --silent start`, or the equivalent `.cursor/mcp.json` entry), then
   **stop**. Never edit the host's MCP config yourself — that is persistent host configuration.
1. **Gate on opt-in.** Read `.claude/sdd.local.md`.
   - **Absent** → the dashboard is opt-in and off by default. Auto-create the file with the documented
     defaults per [`../implement/references/settings.md`](../implement/references/settings.md). The defaults
     include `dashboard_enabled: false` + `dashboard_port: 4178`. Then tell the user: «The dashboard is
     opt-in — set `dashboard_enabled: true` in `.claude/sdd.local.md` and re-run `/sdd:start`.» **Stop.**
   - **Present, `dashboard_enabled` not `true`** → print the same one-line enable instruction and **stop**.
     (Pure-markdown users are unaffected.)
2. **Read the URL file (the common, channel-free path).** Read `~/.claude/sdd-dashboard/current.url`
   (e.g. `cat "$HOME/.claude/sdd-dashboard/current.url"`).
   - **Present** → line 1 is the live dashboard URL. **Print it and go to step 5. Do NOT call any MCP
     tool.** The server is already up and bound. Nothing else is needed. (Optionally note line 2, the
     project dir, if it differs from the current project. That would mean another session's server is
     bound. Tell the user rather than guessing.)
   - **Absent** → the server is connected but idle (it could not resolve the project at boot). Continue to step 3.
3. **(Fallback) check Bun + the MCP server.** Run `bun --version`. If Bun is missing, print «The dashboard
   needs Bun — install from https://bun.sh, then re-run `/sdd:start`. The markdown skills work without it.»
   and **stop**. If the `dashboard_handshake` tool is unavailable, tell the user to check `/mcp` and
   **stop**. The `sdd-dashboard` server may have failed to boot — Bun missing, or `.mcp.json` not picked up.
   Re-open the session.
4. **(Fallback) hand the project over.** Determine the absolute project root. Prefer `git rev-parse --show-toplevel`. Else use the cwd that contains `docs/` or `.git`. Call **`dashboard_handshake`** with `project_dir` set to that path. It binds HTTP, writes `current.url`, and returns the URL. Use the returned URL.
5. **Print the URL + how it behaves.** Show the URL prominently
   (`http://127.0.0.1:<port>/?session=<id>&token=<cap>`) and offer to open it. Then state the
   **load-bearing UX truth** so the user is not surprised:
   - The dashboard is a **driver + observer**, not a synchronous remote control.
   - A click is consumed **only while this session is idle at the prompt**. Mid-task it **queues**.
   - Dashboard-driven runs default to **`--depth=easy`**. The skill then self-decides reversible calls
     and asks far fewer questions. The browser cannot answer a blocking `AskUserQuestion`. If a stage
     genuinely needs a decision, it surfaces in **this terminal** — answer it here.
6. **Handoff.** **Emit the stage-handoff block** per [`../_shared/handoff.md`](../_shared/handoff.md)
   (utility variant). Fill *What I did* with: printed the dashboard URL. Fill *Review* with: open the
   URL. The dashboard mirrors `docs/features/`. The session activity pane streams runs. Fill *Run next*
   with: open the dashboard and click **Run next stage** on a feature, or run a backbone command here
   (e.g. `/sdd:specify <slug>`). `/clear` is **optional** for this utility.

## Definition of Done

- The server is registered on this host (or the registration line was printed and the skill stopped).
- `dashboard_enabled: true` confirmed (or guidance printed + stopped).
- The dashboard URL printed — read from `~/.claude/sdd-dashboard/current.url` on the common path, or (fallback only, when that file is absent) obtained from `dashboard_handshake` after a Bun check.
- **The active driver named**, and with it what a click actually does here: queue into this
  session, start a headless run, or copy the command. A user who thinks a click runs a stage when
  it only fills the clipboard has been misled by this skill.
- The queued/busy/`--depth=easy` behaviour stated so the user knows the dashboard is a driver, not a remote control.
- The stage-handoff block emitted (utility variant).
- This skill writes no artifact. The DoD gates above (registration, opt-in, URL provenance, driver
  named) are its **structural self-check** ([`../_shared/self-check.md`](../_shared/self-check.md)).

## Anti-patterns

- **Editing the host's MCP config to register the server.** Print the line; let the user run it.
- **Reporting «the dashboard drives your session» on a copy-only host.** Name the real driver.
- **Calling `dashboard_handshake` when `current.url` already exists.** The common path is a plain file
  read — the server is already bound. Only hand over via the tool when the URL file is absent.
- **Treating `start` as "boot the server".** The server auto-starts via `.mcp.json`. `start` only prints
  the URL. Never try to spawn `bun` yourself.
- **Proceeding when `dashboard_enabled` is not `true`.** It is opt-in — print the enable line and stop.
- **Fabricating the URL.** It comes only from `current.url` (or the `dashboard_handshake` result) — never
  invent a port or token.
- **Running a dashboard-triggered stage at `--depth=hard`.** Browser-driven runs default to `--depth=easy`.
  A Socratic prompt the browser cannot answer would block the queue.

## References

- [`../implement/references/settings.md`](../implement/references/settings.md) — `.claude/sdd.local.md`,
  including the `dashboard_enabled` / `dashboard_port` keys this skill gates on.
- [`../_shared/handoff.md`](../_shared/handoff.md) — the stage-handoff block (utility variant) this skill emits.
- [`../_shared/tool-adapters.md`](../_shared/tool-adapters.md) — Codex/Cursor mapping, including the
  dashboard driver table (which driver `auto` picks per host, and what a click does under each).
