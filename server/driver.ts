/**
 * Delivery drivers — how a dashboard click reaches an agent.
 *
 * The read half of the dashboard never needed an agent: the HTTP API reads
 * `docs/` off disk, so the pipeline view, the artifacts and the fs.watch
 * refresh work under any host, or under none. Only the DRIVE half was ever
 * Claude-bound, because it rode `notifications/claude/channel`.
 *
 * This module is that half, behind one interface. Four drivers:
 *
 *   claude-channel    the original — an MCP notification into the live session
 *   codex-appserver   Codex's app-server control socket → turn/start on the
 *                     live thread (experimental, opt-in, pairing-gated)
 *   codex-exec        spawn `codex exec <prompt>` — a fresh headless run, not
 *                     the live session; works today with no experimental API
 *   copy              no delivery at all — the browser puts the command on the
 *                     clipboard and the user pastes it
 *
 * `copy` is the floor. It always works, including in Cursor, which exposes no
 * control surface a local process can reach. A host with no driver still gets
 * the whole read-only dashboard; it just hands you the command instead of
 * running it.
 */

import { spawn } from 'child_process'
import { connect } from 'net'
import { homedir } from 'os'
import { join } from 'path'
import type { Frame } from './channel.ts'

export type DriverKind = 'claude-channel' | 'codex-appserver' | 'codex-exec' | 'copy'

/** How a command line is spelled for a host. Claude: `/sdd:design x`. Codex and
 *  Cursor install the skills under an `sdd-` prefix: `$sdd-design x`. */
export type CommandForm = 'claude' | 'codex'

export interface DeliverInput {
  content: string
  meta: Record<string, unknown>
}

export interface DeliverResult {
  /** queued  → handed to a live session, runs when it goes idle
   *  spawned → a fresh headless run started now
   *  copy    → nothing was delivered; the browser must hand it to the user */
  status: 'queued' | 'spawned' | 'copy'
  detail?: string
}

export interface Driver {
  kind: DriverKind
  /** One line for the dashboard topbar. */
  label: string
  /** false → the UI switches Run buttons to copy-to-clipboard. */
  drives: boolean
  commandForm: CommandForm
  deliver(input: DeliverInput): Promise<DeliverResult>
}

// ---- claude-channel ---------------------------------------------------------

/** The original path: an MCP notification only Claude Code consumes. */
export function claudeChannelDriver(
  notify: (params: { content: string; meta: Record<string, unknown> }) => void,
): Driver {
  return {
    kind: 'claude-channel',
    label: 'Claude Code session',
    drives: true,
    commandForm: 'claude',
    async deliver(input) {
      notify({ content: input.content, meta: input.meta })
      return { status: 'queued' }
    },
  }
}

// ---- copy -------------------------------------------------------------------

/**
 * No transport. The command travels to the user, not to an agent — so it must
 * still be spelled the way THEIR host expects, or they paste something that
 * does not exist. A Claude user who forced `dashboard_drive: copy` gets
 * `/sdd:design`, everyone else gets `$sdd-design`.
 */
export function copyDriver(reason: string, form: CommandForm = 'codex'): Driver {
  return {
    kind: 'copy',
    label: `read-only — ${reason}`,
    drives: false,
    commandForm: form,
    async deliver() {
      return { status: 'copy', detail: reason }
    },
  }
}

// ---- codex-exec -------------------------------------------------------------

export interface ExecDeps {
  /** Injected so tests never spawn a real process. */
  spawnProcess?: typeof spawn
  projectDir: () => string | null
  broadcast: (frame: Frame) => void
  log: (msg: string) => void
  /** Binary to run; `codex` unless overridden. */
  bin?: string
}

const EXEC_MAX_CONCURRENT = 2

/**
 * Spawn `codex exec <prompt>` per click and stream its stdout into the activity
 * pane. This is deliberately NOT the user's live session — it is a new headless
 * run with its own context and its own approval posture. The dashboard says so
 * rather than pretending otherwise.
 */
export function codexExecDriver(deps: ExecDeps): Driver {
  const spawnProcess = deps.spawnProcess ?? spawn
  const bin = deps.bin ?? 'codex'
  let running = 0

  return {
    kind: 'codex-exec',
    label: 'Codex — headless run per command',
    drives: true,
    commandForm: 'codex',
    async deliver(input) {
      if (running >= EXEC_MAX_CONCURRENT) {
        return { status: 'copy', detail: `${running} headless runs already in flight — copy and run it yourself` }
      }
      const cwd = deps.projectDir()
      if (!cwd) return { status: 'copy', detail: 'project directory not resolved' }

      running++
      const slug = typeof input.meta.slug === 'string' ? input.meta.slug : null
      const stage = typeof input.meta.stage === 'string' ? input.meta.stage : null
      const child = spawnProcess(bin, ['exec', input.content], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      const pump = (chunk: unknown, level: 'info' | 'error') => {
        const text = String(chunk).trimEnd()
        if (!text) return
        for (const line of text.split('\n')) {
          deps.broadcast({ type: 'log', message: line, slug, stage, level })
        }
      }
      child.stdout?.on('data', (c: unknown) => pump(c, 'info'))
      child.stderr?.on('data', (c: unknown) => pump(c, 'error'))
      child.on('error', (err: Error) => {
        running = Math.max(0, running - 1)
        deps.log(`codex exec failed: ${err.message}`)
        deps.broadcast({ type: 'log', message: `codex exec failed: ${err.message}`, slug, stage, level: 'error' })
      })
      child.on('close', (code: number | null) => {
        running = Math.max(0, running - 1)
        deps.broadcast({
          type: 'log',
          message: `codex exec finished (exit ${code ?? 'signal'})`,
          slug,
          stage,
          level: code === 0 ? 'info' : 'error',
        })
        deps.broadcast({ type: 'refresh', slug })
      })

      return { status: 'spawned', detail: 'headless run — separate context from your terminal session' }
    },
  }
}

// ---- codex-appserver --------------------------------------------------------

export const APPSERVER_SOCKET = join(homedir(), '.codex', 'app-server-control', 'app-server-control.sock')

export interface AppServerDeps {
  socketPath?: string
  broadcast: (frame: Frame) => void
  log: (msg: string) => void
  /** Injected for tests — resolves to a duplex-ish socket. */
  connectSocket?: typeof connect
  timeoutMs?: number
}

/**
 * Drive the live Codex thread over the app-server control socket:
 * initialize → thread/loaded/list → turn/start on the newest loaded thread.
 *
 * Experimental on both ends. The socket only answers a client the daemon has
 * paired (`codex remote-control start` / `pair`); an unpaired connect is closed
 * mid-write. Every failure degrades to `copy` with the reason, never a silent
 * drop — a click that went nowhere is worse than a click that says so.
 */
export function codexAppServerDriver(deps: AppServerDeps): Driver {
  const socketPath = deps.socketPath ?? APPSERVER_SOCKET
  const connectSocket = deps.connectSocket ?? connect
  const timeoutMs = deps.timeoutMs ?? 6000

  return {
    kind: 'codex-appserver',
    label: 'Codex — live thread (experimental)',
    drives: true,
    commandForm: 'codex',
    async deliver(input) {
      try {
        const threadId = await rpcTurnStart(input.content)
        return { status: 'queued', detail: `turn/start on thread ${threadId}` }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        deps.log(`app-server deliver failed: ${msg}`)
        return { status: 'copy', detail: `Codex app-server unreachable (${msg})` }
      }
    },
  }

  function rpcTurnStart(content: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const sock = connectSocket(socketPath)
      let buf = ''
      let done = false
      const finish = (err: Error | null, value?: string) => {
        if (done) return
        done = true
        clearTimeout(timer)
        try {
          sock.end()
        } catch {}
        err ? reject(err) : resolve(value as string)
      }
      const timer = setTimeout(() => finish(new Error('timed out')), timeoutMs)

      const send = (o: unknown) => sock.write(JSON.stringify(o) + '\n')

      sock.on('error', (e: Error) => finish(new Error(e.message)))
      sock.on('close', () => finish(new Error('socket closed — is remote control paired?')))
      sock.on('connect', () => {
        send({
          id: 1,
          method: 'initialize',
          params: { clientInfo: { name: 'sdd-dashboard', title: 'SDD dashboard', version: '1' } },
        })
        send({ id: 2, method: 'thread/loaded/list', params: {} })
      })
      sock.on('data', (chunk: unknown) => {
        buf += String(chunk)
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line) continue
          let msg: Record<string, unknown>
          try {
            msg = JSON.parse(line)
          } catch {
            continue
          }
          if (msg.id === 2) {
            const threadId = firstThreadId(msg.result)
            if (!threadId) return finish(new Error('no loaded Codex thread'))
            send({ id: 3, method: 'turn/start', params: { threadId, input: [{ type: 'text', text: content }] } })
          } else if (msg.id === 3) {
            if (msg.error) return finish(new Error(describeRpcError(msg.error)))
            finish(null, 'live')
          }
        }
      })
    })
  }
}

function firstThreadId(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  const threads = (result as Record<string, unknown>).threads
  if (!Array.isArray(threads) || threads.length === 0) return null
  const t = threads[0] as Record<string, unknown>
  const id = t.threadId ?? t.id
  return typeof id === 'string' ? id : null
}

function describeRpcError(err: unknown): string {
  if (err && typeof err === 'object') {
    const m = (err as Record<string, unknown>).message
    if (typeof m === 'string') return m
  }
  return 'turn/start rejected'
}

// ---- selection --------------------------------------------------------------

export type DriveSetting = 'auto' | 'claude' | 'codex-exec' | 'codex-appserver' | 'copy'

export const DRIVE_SETTINGS: ReadonlySet<string> = new Set([
  'auto',
  'claude',
  'codex-exec',
  'codex-appserver',
  'copy',
])

export interface SelectDeps {
  /** `dashboard_drive` from .claude/sdd.local.md. */
  setting: string
  /** MCP clientInfo.name, when a host connected one. */
  clientName: string | null
  /** Is a `codex` binary runnable? */
  hasCodex: boolean
  claude: () => Driver
  codexExec: () => Driver
  codexAppServer: () => Driver
}

/** True when the connected MCP peer is Claude Code (the only host that consumes
 *  `notifications/claude/channel`). Matched loosely — the client name has
 *  changed spelling before and a miss only costs us the copy fallback. */
export function isClaudeHost(clientName: string | null): boolean {
  if (!clientName) return false
  return /claude/i.test(clientName)
}

/**
 * Pick the driver. An explicit setting always wins — including a wrong one, so
 * a user can force `copy` on a Claude host to keep the browser inert.
 */
export function selectDriver(deps: SelectDeps): Driver {
  const setting = DRIVE_SETTINGS.has(deps.setting) ? (deps.setting as DriveSetting) : 'auto'
  // A copy fallback still has to print a command the user's own host accepts.
  const form: CommandForm = isClaudeHost(deps.clientName) ? 'claude' : 'codex'

  switch (setting) {
    case 'claude':
      return deps.claude()
    case 'codex-exec':
      return deps.hasCodex ? deps.codexExec() : copyDriver('codex binary not found', form)
    case 'codex-appserver':
      return deps.hasCodex ? deps.codexAppServer() : copyDriver('codex binary not found', form)
    case 'copy':
      return copyDriver('dashboard_drive: copy', form)
    case 'auto':
    default:
      if (isClaudeHost(deps.clientName)) return deps.claude()
      if (deps.hasCodex) return deps.codexExec()
      return copyDriver(
        deps.clientName ? `no driver for host "${deps.clientName}"` : 'no agent host detected',
        form,
      )
  }
}
