# Stage handoff — what every skill prints when it finishes (the output contract)

> **Reference-only.** Not a skill. **Every** skill ends by emitting the handoff block defined here.
> The skill emits the block as its **last output**, after it has proposed its commit. The format
> lives only in this file. Each skill keeps a one-line pointer and supplies its own *What I did* /
> *Review* / *next command*. This file exists because a bare «Next: …» line is hard to act on. The
> user cannot tell what changed, which files to open, or what to run next without scrolling back.

Do you run under Codex CLI or Cursor? Current Codex supports `/clear` directly; only the
`/sdd:<next>` invocation changes (`$sdd-<next>` for the script install, `$<next>` for the
marketplace). Cursor maps both forms per [`tool-adapters.md`](./tool-adapters.md).

## TL;DR (українською)

Кожен крок (skill) наприкінці **завжди** друкує однаковий хендоф-блок із трьох секцій:

1. **What I did** — що стадія зробила + який коміт запропонувала (не змушуй гортати вгору).
2. **Review before continuing** — посилання на файли, які стадія створила/змінила і які треба
   глянути на цьому геті (реальні `docs/features/<slug>/…` шляхи — клікабельні/копіювані).
3. **Run next** — спершу `/clear` (обов'язково для forward-переходу — наступна стадія перечитує
   все з диска), потім наступна команда `/sdd:<next> <slug>` у **fenced-блоці** (копіюється в один
   клік) + альтернатива-пропуск, якщо вона є.

Це прибирає головний біль: «погано виводить, незручно копіювати і перевіряти».

---

## The block (sectioned format)

```md
## ✅ <skill> — <slug>

**What I did**
- <1–3 bullets: the artifact(s) produced/changed + the commit proposed>

**Review before continuing**
- `docs/features/<slug>/<file>` — <what to check here>
- `docs/features/<slug>/<file2>` — <…>

**Run next**
1. `/clear` — mandatory (fresh context; the next stage re-reads its inputs from disk)
2. then run:
   ```
   /sdd:<next> <slug>
   ```
   ↳ or `/sdd:<alt> <slug>` to <skip condition>   ← only when a real skip exists
```

Rules for filling it:

- **Always emit it** as the final output. Emit it once per run, after the commit is proposed. Never
  end a skill on a bare «Next: X».
- **What I did** — keep it concrete and self-contained. Name the files written and the proposed
  commit message. The user then does not scroll up to reconstruct them.
- **State the size + route used.** *What I did* names the `feature_size` AND the route the stage
  worked at: «size M + route standard (from `.size`/`.route`)». Did the stage have to **default**
  because a file was missing? Then say so loudly: «size M (default — no `.size`; run
  `/sdd:classify-size <slug>`)», «route standard (default — no `.route`)». A missing size or route
  then surfaces at this gate, not three stages later. A missing `.route` always means `standard`
  (the pre-route behaviour — fully back-compatible). (`specify` establishes both at the start, so
  this should be rare.)
- **Review before continuing** — list **every artifact this stage wrote or changed**. Two skills write nothing (`interview`, `start`): they say so in one line and point at the printed output instead, rather than omitting the section. Give each one
  a real `docs/features/<slug>/…` path (or a repo-root path like `docs/architecture-map.md`) plus a
  one-liner on what to eyeball. This *is* the per-gate review checklist.
- **Run next** — the next command in **`/sdd:<name> <slug>`** form inside a fenced code block. The
  user then copies it in one click. `/clear` is step 1 and **mandatory** for a forward backbone
  handoff. Add a `↳ or …` skip-alternative **only** when one genuinely exists (see the table). The
  skip-alternatives come from the **fast-lane N/A conditions** in
  [`size-matrix.md`](./size-matrix.md). **How each resolves is route-dependent**: auto-skip on
  `quick`, offered on `standard`, suppressed on `full` (see the *Route-resolved forward handoff*
  variant below).
- Keep the `<slug>` substituted with the real slug. Never leave the literal `<slug>` in the printed
  block.

## Variants

- **Backbone forward handoff** (`survey → … → review → ship`): `/clear` mandatory + the next stage.
- **Route-resolved forward handoff** (a backbone stage whose successor is an *optional* stage —
  `specify`, `clarify`, `design`, `sequences`, `data-model`, `tasks`, `refine`): before you print *Run next*,
  resolve the next stage per `docs/features/<slug>/.route` and the Routes table in
  [`size-matrix.md`](./size-matrix.md):
  - **`quick`** — evaluate the next optional stage's N/A condition yourself. Does it hold? Then
    *Run next* names the post-skip stage. *What I did* states «auto-skipped `<stage>`: <reason>».
    The `↳ or` line **inverts** and offers the skipped stage («run the full path»). Does it not
    hold? Then use the normal forward handoff (the stage is not skipped).
  - **`standard`** — normal forward handoff. Add the `↳ or` skip-alternative when the N/A condition
    holds (the user picks).
  - **`full`** — normal forward handoff. **Never** print an `↳ or` skip line.
  Missing `.route` → `standard`. The route steers handoffs only. A stage invoked directly always
  runs.
- **Loop-back** (`review → implement` on `CHANGES REQUESTED`): **no `/clear`**. You stay in context
  to iterate. *Run next* = `/sdd:implement <slug>` (fix). Then re-review the changed surface.
- **Terminal** (`ship`): there is no `/sdd` successor. *Run next* becomes **Done**: the PR
  command/URL + «merging to main is your call». Still print *What I did* + *Review* (the changelog
  + PR).
- **Utility** (`classify-size`, `glossary`, `decide-adr`, `roadmap`, `fix`, `interview`, `loop`,
  `evolve`, `start`): called ad-hoc, not a
  gate. `/clear` is **optional**. Recommend it only if the context is large. *Run next* = «resume
  your backbone stage». Name the likely one (e.g. `/sdd:design <slug>`). Print *What I did* +
  *Review* (the one file it wrote). One exception: `fix` alone adds a **conditional**
  recommendation. When the fix touched >5 files or crossed a module boundary, *Run next* also
  offers `/sdd:review <slug>` (a recommendation, never a gate).

## Canonical sequence (stage → review-files → next)

| Stage | Review before continuing (files written) | Run next |
|---|---|---|
| `survey` | `docs/architecture-map.md` (+ scaffold `tasks.json` on greenfield) | `/sdd:specify <slug>` |
| `specify` | `docs/features/<slug>/spec.md` | `/sdd:clarify <slug>` ↳ or `/sdd:design <slug>` (XS/S, zero §8 OQ — fast lane) |
| `clarify` | `docs/features/<slug>/spec.md` (tightened) | `/sdd:glossary <slug>` ↳ or `/sdd:design <slug>` |
| `design` | `sad.md` (C4 §3/§5 + `target_surfaces`) + `adr/` | `/sdd:sequences <slug>` ↳ or `/sdd:data-model <slug>` (XS/S, no multi-step flow — fast lane) |
| `sequences` | `sad.md` §6 (flows) | `/sdd:data-model <slug>` ↳ or `/sdd:api <slug>` (XS/S, no schema change — fast lane) |
| `data-model` | `data-model.md` + staged `migrations/` | `/sdd:api <slug>` ↳ or `/sdd:tasks <slug>` (XS/S, no contract change — fast lane) |
| `api` | `contracts/openapi.yaml` (+ `events.md`, `api-sync-report.md`) | `/sdd:tasks <slug>` |
| `tasks` | `tasks/` + `tasks.json` | `/sdd:plan-tests <slug>` ↳ then `/sdd:implement <slug>` |
| `plan-tests` | `test-plan.md` (or `spec.md` `## Test plan` for XS/S) | `/sdd:implement <slug>` |
| `implement` | the committed diff (code + tests) + `tasks/tracker.md` | `/sdd:review <slug>` |
| `review` | `_review/review-<date>.md` | `/sdd:ship <slug>` (PASS) · `/sdd:implement <slug>` (CHANGES, no `/clear`) |
| `ship` | `CHANGELOG` + the PR | **Done** — PR command/URL. Merge is your call. |
| `classify-size` | `.size` + `.route` | resume — e.g. `/sdd:specify <slug>` |
| `glossary` | `CONTEXT.md` | resume — e.g. `/sdd:design <slug>` |
| `decide-adr` | `adr/NNNN-<title>.md` | resume — `/sdd:tasks <slug>` or `/sdd:plan-tests <slug>` |
| `roadmap` | `docs/roadmap.md` | resume your backbone stage |
| `fix` | `_fixes/<date>-<short>.md` + the diff (+ the spec patch if any) | resume — or `/sdd:review <slug>` when the fix was wide (>5 files / cross-module) |
| `interview` | **nothing on disk** — the printed summary is the artifact | `/sdd:specify <slug>` when you will build it · else resume what you were doing |
| `refine` | `tasks/` + `tasks.json` (corrected in lockstep) | route-resolved: `/sdd:plan-tests <slug>` ↳ or `/sdd:implement <slug>` |
| `loop` | `.loop/<alias>/artifact.md` + `run.json` + `history.jsonl` | resume the owning skill's flow — e.g. `/sdd:clarify <slug>` after looping a spec |
| `evolve` | `docs/.skill-context/sdd-<skill>/SKILL.md` + `docs/.loop/evolutions/<ts>.md` | resume the backbone · or `/sdd:review <slug>` to check the new rules land |
| `start` | **nothing on disk** — Claude: printed dashboard URL; Codex/Cursor: compatibility note | Claude: open the dashboard · otherwise run a backbone command, e.g. `/sdd:specify <slug>` |

The `↳ or` cells above show the `standard`-route rendering. On `quick` the stage auto-skips and the
`↳ or` inverts. On `full` the `↳ or` line is dropped. See the *Route-resolved* variant.

## Discipline

- **The block is the last thing printed — every run, no exceptions.** A skill that ends on prose
  without it has regressed.
- **Real paths, not descriptions.** «the SAD» is not reviewable. `docs/features/<slug>/sad.md` is.
- **The next command is copy-ready** — `/sdd:<name> <slug>` in a fenced block, slug substituted.
- **`/clear` only where it is correct.** It is mandatory on a forward backbone handoff. It is
  omitted on a loop-back (you iterate). It is optional after a utility.
- **Format canonical here** — a skill that hand-rolls its own block shape has duplicated the
  contract.

## Where each skill calls this

Every skill's final protocol step ends with: «emit the **stage-handoff block** per
[`handoff.md`](./handoff.md)» + its own next command from the table above. The format + variants
live here. The skill supplies only the run-specific content.
