/**
 * driver.ts — the four delivery paths and how one gets picked.
 *
 * The property that matters most here is not "does Codex work". It is that a
 * click NEVER silently disappears: every driver either delivers or returns
 * `copy` with a reason the UI can show.
 */
import { describe, it, expect } from 'bun:test'
import { EventEmitter } from 'events'
import {
  claudeChannelDriver,
  copyDriver,
  codexExecDriver,
  codexAppServerDriver,
  selectDriver,
  isClaudeHost,
} from '../driver.ts'
import { buildCommand, type Frame } from '../channel.ts'

const INPUT = { content: '/sdd:design x --depth=easy', meta: { slug: 'x', stage: 'design' } }

describe('claude-channel driver', () => {
  it('queues via the MCP notification and reports queued', async () => {
    const sent: Array<{ content: string }> = []
    const d = claudeChannelDriver((p) => sent.push(p))
    const r = await d.deliver(INPUT)
    expect(r.status).toBe('queued')
    expect(sent).toHaveLength(1)
    expect(sent[0].content).toBe(INPUT.content)
    expect(d.drives).toBe(true)
    expect(d.commandForm).toBe('claude')
  })
})

describe('copy driver', () => {
  it('delivers nothing and carries the reason', async () => {
    const d = copyDriver('no agent host detected')
    const r = await d.deliver(INPUT)
    expect(r).toEqual({ status: 'copy', detail: 'no agent host detected' })
    expect(d.drives).toBe(false)
  })
})

// ---- codex exec -------------------------------------------------------------

function fakeSpawn() {
  const calls: Array<{ bin: string; args: string[]; cwd?: string }> = []
  const children: FakeChild[] = []
  const spawnProcess = ((bin: string, args: string[], opts: { cwd?: string }) => {
    calls.push({ bin, args, cwd: opts?.cwd })
    const c = new FakeChild()
    children.push(c)
    return c
  }) as unknown as typeof import('child_process').spawn
  return { spawnProcess, calls, children }
}

class FakeChild extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
}

describe('codex-exec driver', () => {
  it('spawns `codex exec <prompt>` in the project dir and reports spawned', async () => {
    const { spawnProcess, calls } = fakeSpawn()
    const frames: Frame[] = []
    const d = codexExecDriver({
      spawnProcess,
      projectDir: () => '/tmp/proj',
      broadcast: (f) => frames.push(f),
      log: () => {},
    })
    const r = await d.deliver(INPUT)
    expect(r.status).toBe('spawned')
    expect(calls).toEqual([{ bin: 'codex', args: ['exec', INPUT.content], cwd: '/tmp/proj' }])
    expect(d.commandForm).toBe('codex')
  })

  it('streams stdout into log frames and refreshes on close', async () => {
    const { spawnProcess, children } = fakeSpawn()
    const frames: Frame[] = []
    const d = codexExecDriver({
      spawnProcess,
      projectDir: () => '/tmp/proj',
      broadcast: (f) => frames.push(f),
      log: () => {},
    })
    await d.deliver(INPUT)
    children[0].stdout.emit('data', 'wrote spec.md\nwrote sad.md\n')
    children[0].emit('close', 0)
    const logs = frames.filter((f) => f.type === 'log').map((f) => f.message)
    expect(logs).toContain('wrote spec.md')
    expect(logs).toContain('wrote sad.md')
    expect(frames.some((f) => f.type === 'refresh' && f.slug === 'x')).toBe(true)
  })

  it('degrades to copy when the project dir is unresolved', async () => {
    const { spawnProcess, calls } = fakeSpawn()
    const d = codexExecDriver({ spawnProcess, projectDir: () => null, broadcast: () => {}, log: () => {} })
    const r = await d.deliver(INPUT)
    expect(r.status).toBe('copy')
    expect(calls).toHaveLength(0)
  })

  it('degrades to copy rather than piling up unbounded headless runs', async () => {
    const { spawnProcess } = fakeSpawn()
    const d = codexExecDriver({ spawnProcess, projectDir: () => '/tmp/proj', broadcast: () => {}, log: () => {} })
    expect((await d.deliver(INPUT)).status).toBe('spawned')
    expect((await d.deliver(INPUT)).status).toBe('spawned')
    const third = await d.deliver(INPUT)
    expect(third.status).toBe('copy')
    expect(third.detail).toContain('in flight')
  })

  it('reports a failed spawn instead of swallowing it', async () => {
    const { spawnProcess, children } = fakeSpawn()
    const frames: Frame[] = []
    const d = codexExecDriver({
      spawnProcess,
      projectDir: () => '/tmp/proj',
      broadcast: (f) => frames.push(f),
      log: () => {},
    })
    await d.deliver(INPUT)
    children[0].emit('error', new Error('ENOENT'))
    expect(frames.some((f) => f.level === 'error' && String(f.message).includes('ENOENT'))).toBe(true)
  })
})

// ---- codex app-server -------------------------------------------------------

class FakeSocket extends EventEmitter {
  written: string[] = []
  write(s: string) {
    this.written.push(s)
    return true
  }
  end() {}
}

function appServerWith(handler: (sock: FakeSocket, msg: Record<string, unknown>) => void) {
  const sock = new FakeSocket()
  const connectSocket = (() => {
    queueMicrotask(() => sock.emit('connect'))
    return sock
  }) as unknown as typeof import('net').connect
  sock.on('__sent', () => {})
  const origWrite = sock.write.bind(sock)
  sock.write = (s: string) => {
    const ok = origWrite(s)
    for (const line of s.split('\n')) {
      if (!line.trim()) continue
      handler(sock, JSON.parse(line))
    }
    return ok
  }
  return { sock, connectSocket }
}

describe('codex-appserver driver', () => {
  it('initializes, finds the loaded thread and starts a turn with the command', async () => {
    const seen: Record<string, unknown>[] = []
    const { sock, connectSocket } = appServerWith((s, msg) => {
      seen.push(msg)
      if (msg.method === 'thread/loaded/list') {
        queueMicrotask(() =>
          s.emit('data', JSON.stringify({ id: 2, result: { threads: [{ threadId: 'th-1' }] } }) + '\n'),
        )
      }
      if (msg.method === 'turn/start') {
        queueMicrotask(() => s.emit('data', JSON.stringify({ id: 3, result: {} }) + '\n'))
      }
    })
    const d = codexAppServerDriver({ connectSocket, broadcast: () => {}, log: () => {} })
    const r = await d.deliver(INPUT)
    expect(r.status).toBe('queued')
    const turn = seen.find((m) => m.method === 'turn/start') as Record<string, unknown>
    expect(turn).toBeTruthy()
    expect((turn.params as Record<string, unknown>).threadId).toBe('th-1')
    expect(JSON.stringify(turn.params)).toContain(INPUT.content)
    expect(sock.written.length).toBeGreaterThan(0)
  })

  it('degrades to copy when no thread is loaded', async () => {
    const { connectSocket } = appServerWith((s, msg) => {
      if (msg.method === 'thread/loaded/list') {
        queueMicrotask(() => s.emit('data', JSON.stringify({ id: 2, result: { threads: [] } }) + '\n'))
      }
    })
    const d = codexAppServerDriver({ connectSocket, broadcast: () => {}, log: () => {} })
    const r = await d.deliver(INPUT)
    expect(r.status).toBe('copy')
    expect(r.detail).toContain('no loaded Codex thread')
  })

  it('degrades to copy when the socket closes unpaired', async () => {
    const { connectSocket } = appServerWith((s, msg) => {
      if (msg.method === 'initialize') queueMicrotask(() => s.emit('close'))
    })
    const d = codexAppServerDriver({ connectSocket, broadcast: () => {}, log: () => {} })
    const r = await d.deliver(INPUT)
    expect(r.status).toBe('copy')
    expect(r.detail).toContain('paired')
  })
})

// ---- selection --------------------------------------------------------------

const pick = (over: Partial<Parameters<typeof selectDriver>[0]>) =>
  selectDriver({
    setting: 'auto',
    clientName: null,
    hasCodex: false,
    claude: () => claudeChannelDriver(() => {}),
    codexExec: () => codexExecDriver({ projectDir: () => '/p', broadcast: () => {}, log: () => {} }),
    codexAppServer: () => codexAppServerDriver({ broadcast: () => {}, log: () => {} }),
    ...over,
  })

describe('selectDriver', () => {
  it('auto: Claude Code host → the channel driver', () => {
    expect(pick({ clientName: 'claude-code' }).kind).toBe('claude-channel')
    expect(pick({ clientName: 'Claude Code (desktop)' }).kind).toBe('claude-channel')
  })

  it('auto: non-Claude host with codex present → headless exec', () => {
    expect(pick({ clientName: 'codex', hasCodex: true }).kind).toBe('codex-exec')
  })

  it('auto: non-Claude host with no codex → copy, naming the host', () => {
    const d = pick({ clientName: 'cursor' })
    expect(d.kind).toBe('copy')
    expect(d.label).toContain('cursor')
  })

  it('auto: no host at all → copy', () => {
    expect(pick({}).kind).toBe('copy')
  })

  it('a copy fallback still spells the command for the user’s own host', () => {
    expect(pick({ setting: 'copy', clientName: 'claude-code' }).commandForm).toBe('claude')
    expect(pick({ setting: 'copy', clientName: 'cursor' }).commandForm).toBe('codex')
    expect(pick({ setting: 'codex-exec', hasCodex: false, clientName: 'claude-code' }).commandForm).toBe('claude')
  })

  it('an explicit setting overrides detection, including forcing copy on Claude', () => {
    expect(pick({ setting: 'copy', clientName: 'claude-code' }).kind).toBe('copy')
    expect(pick({ setting: 'codex-appserver', clientName: 'claude-code', hasCodex: true }).kind).toBe(
      'codex-appserver',
    )
  })

  it('a codex setting without the binary falls back to copy, not a broken driver', () => {
    expect(pick({ setting: 'codex-exec', hasCodex: false }).kind).toBe('copy')
    expect(pick({ setting: 'codex-appserver', hasCodex: false }).kind).toBe('copy')
  })

  it('an unknown setting is treated as auto rather than disabling the dashboard', () => {
    expect(pick({ setting: 'nonsense', clientName: 'claude-code' }).kind).toBe('claude-channel')
  })

  it('isClaudeHost is loose but not empty-matching', () => {
    expect(isClaudeHost('claude-code')).toBe(true)
    expect(isClaudeHost('Claude')).toBe(true)
    expect(isClaudeHost('codex')).toBe(false)
    expect(isClaudeHost(null)).toBe(false)
    expect(isClaudeHost('')).toBe(false)
  })
})

describe('command form follows the host', () => {
  it('claude gets /sdd:, codex gets the sdd- prefixed skill', () => {
    expect(buildCommand('design', 'x', { form: 'claude' }).content).toBe('/sdd:design x --depth=easy')
    expect(buildCommand('design', 'x', { form: 'codex' }).content).toBe('$sdd-design x --depth=easy')
  })

  it('the allowlist still gates both forms', () => {
    expect(() => buildCommand('rm -rf /', 'x', { form: 'codex' })).toThrow()
    expect(() => buildCommand('design', '../etc', { form: 'codex' })).toThrow()
  })
})
