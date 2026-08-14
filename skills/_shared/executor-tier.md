# Executor tier — writing the plan for whoever will execute it

> **Reference-only.** Not a skill. `tasks` is the canonical producer (it calibrates the breakdown);
> `refine` reads the same key when it re-checks a plan. The dial answers one question: **how capable
> is the model that will turn this plan into code?** It never changes *what* the plan covers — only
> how much the plan spells out.

## TL;DR (українською)

`executor_tier` (`.claude/sdd.local.md`, дефолт `balanced`) — це **єдиний регулятор, який описує
виконавця, а не роботу**. Решта дилів описують саме роботу: `.size` — наскільки велика фіча,
`.route` — які стадії обов'язкові, `interview_depth` — скільки питати користувача. Цей — про те,
**хто писатиме код за планом**.

На `cheap` план стає **дрібнішим і буквальнішим**: задачі по пів дня замість дня, `files_hint`
називає конкретні файли (не каталоги), у нотатках прямо вказано файл-прецедент («зроби як ось цей»),
кроки всередині задачі пронумеровані, і **жодного відкритого рішення** не залишається виконавцю.

Чого `cheap` **не** робить: не копіює текст AC, схеми чи контракту в тіло задачі. Посилання
лишаються посиланнями — інакше копія розійдеться з джерелом і почне брехати. Покриття AC не
залежить від тиру взагалі: план однаково покриває всі AC на будь-якому рівні.

---

## What the dial is not

Three dials already exist, and each answers a different question. Confusing them produces a plan
that is detailed in the wrong dimension:

| Dial | Question it answers | Owner |
|---|---|---|
| `.size` (XS–XL) | How big is the feature? | [`size-matrix.md`](./size-matrix.md) |
| `.route` (quick/standard/full) | Which optional stages run? | [`size-matrix.md`](./size-matrix.md) |
| `interview_depth` (easy/medium/hard) | How much do we ask the user? | [`interview-depth.md`](./interview-depth.md) |
| **`executor_tier`** (cheap/balanced/judgment) | **How capable is the coder?** | this file |

An XL feature planned for a cheap executor and an XS feature planned for a strong one are both
legitimate combinations. The dials are orthogonal — never derive one from another.

## The three tiers

Values reuse the portable tier-labels from [`agent-roster.md`](./agent-roster.md), so one vocabulary
covers models and executors alike.

- **`cheap`** — the plan will be executed by a small model (or a fresh contributor with no context).
  Assume it will not follow a link, will not infer an unstated convention, and will not resolve an
  open choice well. Spell out what the deltas below name.
- **`balanced`** (default) — today's behaviour, unchanged. The executor reads linked artifacts and
  infers repo conventions from precedent.
- **`judgment`** — a strong executor. Tasks may stay wider where the work is genuinely coupled;
  the plan may leave a well-bounded implementation choice to the executor and say so explicitly.

## What changes at `cheap` (the six deltas)

Each delta is a property of the *plan's shape*, not a copy of upstream content — see the hard rule
below for why that distinction is the whole design.

1. **Half-day tasks.** The atomic ceiling drops from ≤1 working day to ≤half a day; the
   too-wide smell threshold drops from ~500 LOC to ~250. A task a strong executor takes in one pass
   is split at the seam a weak one would lose.
2. **`files_hint` names files, not directories.** `["internal/notify/email.go"]`, never
   `["internal/notify/"]`. A directory asks the executor to pick; a path does not.
3. **A named precedent.** `## Notes` carries one line: «model this on `<existing file>`» — the
   closest existing implementation of the same shape. This is the repo's own
   copy-the-closest-precedent rule, made explicit instead of left to judgment.
4. **Ordered steps.** `## What` becomes a numbered sequence, not a prose paragraph. The order is
   the one the executor should follow, including where the test comes first.
5. **Zero open decisions.** No «choose an appropriate X», no «decide the error shape». Any such
   choice is either resolved while planning (and recorded where decisions live — an ADR or the
   section it belongs to) or promoted into its own task. A weak executor resolves an open choice
   badly and silently.
6. **DoD names the command.** «`go test ./internal/notify/...` passes» rather than «unit tests
   pass». The executor should not have to derive the verification command.

## The hard rule — precision, never duplication

`cheap` makes the plan **more precise**, never **more redundant**. It does not inline the text of an
acceptance criterion, a schema field, or a contract fragment into a task body. That prohibition is
not stylistic: an inlined copy silently becomes a lie the moment the spec is clarified, and nothing
in the pipeline would catch it. The task template's «Link the upstream source, don't paste it» and
the `tasks` anti-pattern «Task body duplicates spec AC — link, don't paste» hold at **every** tier.

What the six deltas add — a path, a precedent, an order, a command — are all facts *about the plan
itself*. They have no upstream source to drift from.

If a plan genuinely cannot be executed without upstream prose in front of the executor, that is a
signal the task is too wide (delta 1), not a licence to copy.

## What never changes with the tier

- **AC coverage.** Every spec §5 acceptance criterion is covered at every tier. `cheap` splits the
  work differently; it never covers less.
- **The DAG.** Dependencies express real ordering constraints, not executor capability. A cheap-tier
  plan has more nodes, not different edges.
- **The gates.** `implement`'s per-task gate, the TDD cycle, and the review pass are identical.
- **`tasks.json` schema.** No new fields. The tier changes the *values* (more, narrower tasks with
  sharper `files_hint`), never the contract `implement` reads.

## How a skill reads it

Resolve once, at the top of the run, in this precedence (highest wins):

1. `--executor=cheap|balanced|judgment` passed on the invocation.
2. `executor_tier` in `.claude/sdd.local.md`
   (documented in [`../implement/references/settings.md`](../implement/references/settings.md)).
3. Default **`balanced`** — the behaviour every existing plan was written under.

State the resolved tier in one line of the handoff when it is not `balanced`, so a reader knows why
the breakdown looks finer than usual.

## Consumers

- **`tasks`** — the producer. Applies the six deltas while decomposing.
- **`refine`** — re-checks an existing plan against the tier. On `cheap`, a directory-shaped
  `files_hint`, an open choice, or a full-day task is a finding in its normal categories, not a new
  one.

`implement` does **not** read this key: it consumes `tasks.json`, which is already calibrated. The
tier is a planning-time concern only.
