# Size matrix — XS/S/M/L/XL classification + MVP-vs-Full artifact set

> **Reference-only.** Not a skill. `classify-size` is the canonical owner of this matrix. Every
> other skill reads it. The matrix decides how much of its artifact each skill produces (MVP vs
> Full). It also decides how deep the Socratic pass runs.

## TL;DR (українською)

`classify-size` класифікує фічу **XS/S/M/L/XL** за чотирма сигналами (кількість PR / час / нові
модуль-API-міграція / breaking changes) і пише два файли-токени: `.size` та маршрут `.route`
(`quick`/`standard`/`full`; дефолт XS/S→quick, M→standard, L/XL→full — підтверджується одним
питанням). Розмір вирішує, MVP чи Full версію артефакту продукує кожен скіл; маршрут — як хендофи
трактують необов'язкові стадії (авто-скіп із названою причиною / запропонувати вибір / все
запускати). Умови пропуску — це **N/A-умови, не дефолти розміру**: XS-фіча з міграцією все одно
проходить `data-model`, на будь-якому маршруті.

---

## How to classify size

The four signals (`classify-size` asks one `AskUserQuestion` per signal):

| Signal | XS | S | M | L | XL |
|---|---|---|---|---|---|
| **PR count** | 1 | 2–5 | 5–15 | 15+ | many, staged |
| **Time to merge main part** | ≤1 day | ~1 week | 1–2 sprints | >1 month | own roadmap |
| **New module / new API / migration** | none | ≤1 of three | 1–2 of three | 2–3 of three | new subsystem |
| **Breaking changes for consumers** | no | internal only | internal or public | public | public + cross-team |

- **XS** — 1 PR, ≤1 day, no migration, no new API. (Typo, copy fix, config tweak.)
- **S** — 2–5 PRs, ~1 week, maybe a small migration.
- **M** — separate epic, 1–2 sprints, new module / API / migration.
- **L** — cross-module, several teams, breaking changes possible.
- **XL** — new subsystem, needs a separate roadmap.

On edge cases, name the dominant signal: «this is M because it adds a new API + 1–2 sprints, even though PR count is on the S/M border».

> **One-sentence rule.** If you hesitate between MVP and Full — start with MVP. Filling the empty sections of an artifact later is cheaper than discarding pre-built ones.

## MVP-vs-Full artifact set

Artifact depth ∝ feature size. XS/S → minimal set. M+ → full.

| Artifact (skill) | MVP (XS/S) | Full (M+) |
|---|---|---|
| spec — `specify` | yes | yes |
| clarify pass — `clarify` | light (always run — `specify`'s handoff offers the skip per the fast lane below) | yes |
| CONTEXT.md glossary — `glossary` | yes | yes |
| SAD (Arc42 12 §) + C4 L1/L2 — `design` | 12 sections walked, more `<!-- N/A -->` allowed | all 12 filled |
| ADRs (in `adr/`) — `design` / `decide-adr` | 2–4 typical | 5–12 typical |
| sequence diagrams — `sequences` | every AC covered, detail collapsed | as many flows as the user-stories/ACs need — never a cap. XS/S may collapse detail but still cover every AC |
| deployment view — `design` §7 | `<!-- N/A -->` if no infra change | yes |
| data-model + migrations — `data-model` | if DB touched | yes |
| API contract (OpenAPI) — `api` | yes | yes |
| events — `api` | if async | yes |
| task breakdown + tasks.json — `tasks` | yes | yes |
| test-plan — `plan-tests` | inline in spec | separate file |
| implementation — `implement` | yes | yes |

## Routes — quick / standard / full (the auto-router)

The **route** decides how each handoff handles the optional stages (`clarify`, `sequences`,
`data-model`, `api`, `plan-tests`). It lives in **`docs/features/<slug>/.route`**. The file is one
line, plain text, with exactly one of `quick` / `standard` / `full` (same discipline as `.size`:
no comments, no frontmatter — wrappers grep it cheaply). `classify-size` (the canonical owner)
writes it. `specify` step 1 also writes it when it classifies inline. The route **default derives
from the size**: **XS/S → `quick`, M → `standard`, L/XL → `full`**. The **same single
`AskUserQuestion`** confirms the route together with the size. The user may pick a different route
than the default. A `quick` L is legal, just loud.

| Route | Handoff behaviour at an optional stage |
|---|---|
| `quick` | the producing stage **evaluates the N/A condition itself** (table below). Condition holds → **auto-skip** the stage and state the reason in the handoff («auto-skipped `clarify`: zero §8 OQ»). The `↳ or` alternative **inverts** and offers the *skipped* stage («run the full path»). Condition does **not** hold → the stage is not skipped. Use the normal forward handoff. |
| `standard` | today's behaviour. The handoff names the next stage. It **offers** the skip as the `↳ or` alternative when the N/A condition holds. The **user** picks. |
| `full` | no skip alternatives. Every optional stage runs. The handoff never prints an `↳ or` skip line. |

**Quick-route softenings** (in addition to the auto-skip): `design` recommends `--depth=easy` in
the question that sets its depth dial. `plan-tests` always collapses to the inline `## Test plan`
in `spec.md`. `clarify` auto-skips when the spec has zero §8 open questions.

**Missing `.route`** → behave as `standard` (the pre-route default) and say so in the handoff:
«route standard (default — no `.route`; run `/sdd:classify-size <slug>`)». This is fully
back-compatible.

**Mid-flight override.** The route steers **handoffs only**. It never makes a stage refuse. To
change course, re-run `/sdd:classify-size <slug>` (it rewrites `.route`). Or invoke a skipped
stage directly. It runs normally regardless of the route.

### The N/A conditions (the fast-lane table)

Every condition is a **«skip when N/A»** condition, never «skip always». An XS feature *with* a
schema change still runs `data-model` — on every route.

| Stage | Skip when (the N/A condition) | Who evaluates/offers it |
|---|---|---|
| `clarify` | the spec came out with **zero §8 open questions** and no AC was flagged ambiguous during specify | `specify`'s handoff |
| `sequences` | **one actor and no multi-step runtime flow** — a single request/response or a pure rule change. Nothing an `alt`-branch diagram would reveal. | `design`'s handoff |
| `data-model` | **no schema change** — no new entity, column, index, or migration | `sequences`' handoff |
| `api` | **no contract change** — no new/changed endpoint, event, CLI command, or public signature (the skill also self-skips on «no external interface»). `api` **accepts a legally-skipped `data-model`** (no schema change). It derives from the existing schema. Its hard gate fires only when a schema change exists. | `data-model`'s handoff |
| `plan-tests` | never fully skipped. It **collapses to the inline `## Test plan`** in `spec.md` (cheap — always inline on `quick`). Skip it entirely only when every task's DoD already names its test. | `tasks`' handoff |
| `refine` | **always optional**. It is the opt-in *second pass* over the task plan (clean-context re-analysis of the codebase, finding categories, optional `+check` validator). It is **never part of the mandatory backbone** and **never auto-runs**. `tasks`' handoff offers it as the `↳ or /sdd:refine <slug>` alternative (route-resolved: `quick` → mentioned-but-auto-skip, `standard` → offered, `full` for L/XL → recommended). The plan is already implement-ready after `tasks`' step-12 self-check. `refine` is the deeper second iteration for when the first pass was not enough. | `tasks`' handoff |

**Never skippable — on any route:** `specify` (the spec is the trace anchor), `design` (declares
`target_surfaces` + the ADR gate), `tasks` (`implement` consumes `tasks.json`), `implement`,
`review`, `ship`. The shortest legal route is therefore
`specify → design → tasks → implement → review → ship`. A `quick` XS feature closes in one session.

Several consecutive stages may be N/A. At each handoff, walk the conditions in order. Jump to the
first stage whose condition does **not** hold. Skipping `sequences` moves its `data-model`
skip-question into `design`'s handoff, and so on. On `quick` the stage walks them itself. On
`standard` it offers each hop as the `↳ or` alternative.

## Surface count is a second scaling axis

Size (XS–XL) is the *depth* dial. The number of **target surfaces** a feature declares (in
`design`, written to `sad.md` frontmatter `target_surfaces` → [`./surfaces.md`](./surfaces.md)) is
a second, *breadth* axis on the artifact set. Each surface adds its own work. A UI surface
(`web-frontend` / `mobile-app` / `desktop-app`) adds the `ui` task layer, UI-driven §6 flows, and
the component / visual-regression / e2e-through-UI test tiers. A `cli` / `worker` / `library-sdk`
surface adds its own contract form + flows. A multi-surface feature (`[backend-service,
web-frontend]`) is therefore genuinely **larger** than a single-surface one of the same XS/S/M
class. This file adds no new column. Expect more tasks, more flows, and more test rows per extra
surface.

## SAD size behaviour

Even for XS/S, `design` walks all 12 Arc42 sections — consistency beats completeness theatre.
Sections that genuinely don't apply get `<!-- N/A: <one-line reason> -->`. Common XS/S N/A
patterns:

- §7 Deployment — `<!-- N/A: reuses existing deployment unit, no infra change -->`
- §6 Runtime — collapses to the **fewest flows that still cover every §5 AC** (often one flow
  with the error branches inline as `alt`, rather than separate failure-mode flows). Detail
  collapses. AC-coverage does not. `sequences` still maps every AC to a flow, a branch, or an
  explicit N/A even at XS/S.
- §11 Risks — one accepted-debt row, no medium/high risks.

Same skill, same template, smaller content footprint.

## Wrappers / gates

A skill that reads `.size` skips heavy sub-artifacts for XS/S (separate test-plan, deployment
view, full ADR sweep). `specify` **establishes `.size` at the start of the backbone** (it
classifies + writes it if absent). Later stages normally read a real size. A stage that *still*
finds none (e.g. `design` run standalone, before `specify`) defaults to **M** (the safe
over-production default) **and says so in its handoff**. Never make a silent assumption.
