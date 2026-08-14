# Target surfaces — what's being built (the C4-container surface taxonomy)

> **Reference-only.** Not a skill. `design` is the canonical owner of the **selection**. It picks the surface or surfaces and writes them to `sad.md`. The stages `api` / `sequences` / `tasks` / `plan-tests` / `review` **read** the declaration. Each of these stages gates its own output by it. Each stage keeps a one-line pointer here plus its own delta. The taxonomy and the gating table live **only** in this file. No skill duplicates them.

## TL;DR (короткий вступ українською)

«Таргет-сёрфейс» (target surface) — це **що саме ми будуємо** для фічі: бекенд-сервіс, веб-фронтенд,
мобільний застосунок, CLI тощо — «різні речі». Раніше плагін мовчазно припускав один зріз
(сервіс + його HTTP-контракт), а фронт жив як «зовнішній споживач». Тепер `design` **явно обирає**
поверхні на етапі архітектури, записує їх у `sad.md` → frontmatter `target_surfaces: [...]`, і всі
наступні етапи **читають** цей вибір (а не передеривовують щоразу), щоб увімкнути саме свої
поверхне-специфічні артефакти: UI-архітектурні ADR, шар задач `ui`, фронтові рівні тестів,
UI-орієнтовані flow-діаграми, правильну форму `api`-контракту.

Поверхня прив'язана до C4: **поверхня = контейнер C4, який фіча вводить або володіє ним**. Це не нове
поняття — плагін уже говорить мовою C4 у §5 SAD; тут лише робимо вибір контейнерів **явним і типізованим**.

---

## The model — a surface is a C4 container the feature owns

«Surface» is our coinage. We anchor it to vocabulary the plugin already speaks. C4 calls the unit
**container**. A container is *a separately runnable or deployable thing: an application or a data
store* ([c4model.com/abstractions/container](https://c4model.com/abstractions/container)). The C4
container diagram declares surfaces **and their technology** together. C4 already splits one feature
into **one container per surface**. A server-rendered web app is one container. A significant SPA is
two containers: the backend API + the SPA. The worked example on c4model.com is five: Backend API +
SPA + server-side web app + mobile app + database.

So: **a target surface = a C4 container the feature introduces or owns.** To pick the surfaces *is*
to decide which §5 containers the feature draws. Data stores are **not** surfaces. A data store is
a `ContainerDb` that `data-model` owns. A surface is a thing that *runs behaviour*. A data store is
a thing that *holds state*.

## The taxonomy (C4-grounded, fixed-but-extensible)

Seven surfaces exist. Each surface is a C4 container type from the c4model.com enumeration
(server-side web app, client-side SPA, desktop app, mobile app, console/CLI app, serverless
function/worker, + data stores):

| Surface | What it is (the C4 container) | Typical owner |
|---|---|---|
| `backend-service` | A server-side application that exposes an interface (HTTP/REST, gRPC, or events). The default. | Backend Lead |
| `web-frontend` | A browser-delivered UI. It is **server-rendered (SSR)** *or* a **client-side SPA** (the sub-kind is a UI-architecture decision). | Frontend Lead |
| `mobile-app` | A native or cross-platform app on a phone/tablet. | Mobile Lead |
| `desktop-app` | A native or cross-platform desktop application. | Desktop Lead |
| `cli` | A console or command-line application — commands, flags, exit codes. | Backend Lead |
| `worker` | An event-consumer / scheduled job / serverless function. It has no request/response surface. | Backend Lead |
| `library-sdk` | A library or SDK. The public signatures/types it exposes are the contract. | Lib owner |

The list is **fixed but extensible**. A genuinely new surface (e.g. a voice/IVR or an embedded
firmware target) extends the table here, in one place. A consuming skill never extends the table.
Most features pick **one or two** surfaces (`[backend-service]`, or `[backend-service,
web-frontend]` for a fullstack feature). A multi-surface feature is **larger**. Each surface adds
its own layer + test tiers (see [`./size-matrix.md`](./size-matrix.md)). Multi-surface is itself
usually a blast-radius decision (irreversible / multi-module → an ADR).

## The contract — declared once at design, read (never re-derived) downstream

This is the load-bearing rule, and the novel part. No surveyed tool gates *which design artifacts
are generated* by surface (spec-kit gates file paths, Kiro gates Feature-vs-Bug).
Surface-**gated artifact selection** is ours. The mechanism is the same «declare → conditionally
include» pattern, applied to the artifact axis:

1. **`design` declares.** The Target-surface decision is the **first** §4 Solution-Strategy decision.
   `design` derives it from spec §1 «for whom» + §4 roles. The spec stays product-level — it never
   names a surface. The blast-radius gate gates this decision (multi-surface ⇒ usually an ADR). The
   §5 C4 Container view shows it as one container per surface.
2. **`design` writes it to the SAD frontmatter** — `target_surfaces: [backend-service,
   web-frontend]`. The field is machine-readable. It mirrors how `feature_size` is carried.
3. **Downstream reads it, never re-derives it.** `api` / `sequences` / `tasks` / `plan-tests` /
   `review` read the `sad.md` frontmatter field `target_surfaces`. They gate their output by the
   table below. They do **not** re-infer the surface from the architecture map each run. `design`
   already decided, once.

This **generalizes `api`'s existing interface-kind awareness up one level**. `api` no longer
silently re-derives the contract kind (HTTP / gRPC / CLI / events) every run. `design` declares the
surface or surfaces once. `api` and the other stages read that declaration. The
derive-from-architecture-map path stays only as the **fallback**. It applies when the SAD or the
field is absent (a greenfield run where `design` was skipped).

## The gating table (what each surface turns on)

Each consuming skill reads `target_surfaces`. It includes only the rows that its declared surfaces
select:

| Surface | `api` contract form | `sequences` flows | `tasks` layers | `plan-tests` tiers added |
|---|---|---|---|---|
| `backend-service` | OpenAPI / gRPC / events (per the sub-kind) | service + async flows | domain · infra · app · ports | (existing) unit · integration · contract |
| `web-frontend` | *consumes* the backend contract (does not author it) | UI-driven (`<user>` → `<ui>` → `<service>` → `<data-store>`) | **`ui`** | **component · visual-regression · e2e-through-UI** |
| `mobile-app` | consumes the contract | UI-driven | **`ui`** | component · e2e-through-UI |
| `desktop-app` | consumes the contract | UI-driven | **`ui`** | component · e2e-through-UI |
| `cli` | `contracts/cli.md` (commands/flags/exit-codes) | command flows | app · ports | unit · e2e (command) |
| `worker` | `contracts/events.md` (no request/response) | async flows | domain · infra | unit · integration |
| `library-sdk` | `contracts/public-api.md` (public signatures) | usage flows | domain · app | unit · contract |

Read it this way. A feature with `[backend-service, web-frontend]` produces the backend contract
**and** a `ui` task layer. It produces UI-driven sequence flows alongside the service flows. It adds
the component / visual-regression / e2e-through-UI test tiers on top of the backend's
unit/integration/contract tiers.

## The UI-architecture decision (per UI surface — kept light, Option B)

For each declared **UI surface** (`web-frontend` / `mobile-app` / `desktop-app`), `design` runs a
follow-on **UI-architecture decision**. This decision evolves today's «read-side delivery (SSR /
SPA / API-only)» §4 item into a per-surface choice:

- **web** → server-rendered (SSR) / SPA / hybrid.
- **mobile** → native / cross-platform.
- plus **state-management** and **routing** *only if* the feature's complexity warrants them.

The blast-radius gate gates it like any §4 strategic decision. When it crosses the gate, it becomes
an ADR in §9. Keep it **light**: this is the **only** UI artifact the plugin generates. There is
deliberately **no** component-tree, no design-token doc, and no screen/wireframe artifact. Those
would need a separate deep UI-design pipeline, which is out of scope. The `ui` task layer, the
UI-architecture ADR, the frontend test tiers, and the UI sequence flows are the whole of the
frontend footprint.

## Reuse the existing UI foundation (don't reinvent)

A `ui`-surface feature **composes and extends the design system the repo already has**. It does not
hand-roll new styles, tokens, or primitives that duplicate existing ones. `survey` inventories that
foundation in `architecture-map.md` **§Frontend / UI foundation**: component library / design
system, design tokens, styling approach, shared primitives, and the closest UI precedent. The
stages `design` / `tasks` / `implement` / `review` **read it and reuse** it:

- build a new screen from the **existing components + tokens + styling approach**. Model it on the
  closest existing screen (the UI precedent).
- write a **new** component only when no existing primitive fits. Build it in the repo's styling
  approach, not a second one.
- read design tokens (colors / spacing / typography) from the repo's token source. Never re-declare
  them inline.

This is the frontend echo of the backend rule «match the repo's conventions + copy the closest
precedent». It is the same reuse discipline, applied to UI. A `ui` task that recreates an existing
Button/Card/modal, or introduces a second styling system, is the anti-pattern this file stops.

## The frontend test tiers (testing-trophy provenance)

The component / visual-regression / e2e-through-UI tiers that `plan-tests` adds for a UI surface
come from the **«testing trophy»**. It is the dominant frontend testing vocabulary (web.dev's
testing strategies, Kent C. Dodds): static → unit → integration (incl. **component** and API tests)
→ UI (incl. **E2E** and **visual / visual-regression**)
([web.dev/articles/ta-strategies](https://web.dev/articles/ta-strategies)). It is the **dominant
vocabulary, not a mandate**. It is **stack-agnostic** here: `plan-tests` names the *tier*, never the
tool. `implement` detects the actual runner (Playwright / Storybook / a visual-regression tool /
etc.) from the repo. It does this exactly as it already does for the backend tiers.

## Discipline

- **The taxonomy + gating table live here only.** A consuming skill that copies the table has
  duplicated the source of truth. It keeps a one-line pointer + its own delta instead.
- **`design` writes `target_surfaces`. Nobody else writes it.** Downstream reads it. A skill that
  re-derives the surface after the SAD declared it is the anti-pattern this file kills. It has the
  same shape as `api` double-deriving the interface kind.
- **The spec stays product-level.** `design` derives surfaces from spec §1/§4. The spec never names
  a surface, a stack, or an endpoint group.
- **Option B boundary.** Thread frontend-awareness through the existing stages. Do **not** grow a
  parallel UI-design pipeline. Emit no component-tree / token / screen artifact. A run that starts
  one has left the scope this file fixes.
- **Data stores are not surfaces.** A `ContainerDb` is `data-model`'s job. A surface runs behaviour.
- **Reuse the UI foundation.** `ui`-layer work composes the repo's existing design system /
  components / tokens / styling (from `architecture-map.md` §Frontend). It never reinvents them. A
  new primitive needs a justification that no existing one fits.

## Where each skill reads this

- **`design`** — owns the **selection**. The Target-surface decision is §4's first decision. The
  UI-architecture decision follows per UI surface. Both gate to ADRs. `design` writes
  `target_surfaces` to `sad.md` frontmatter. It draws one §5 C4 container per surface.
- **`api`** — reads `target_surfaces` first to pick the contract form (the table). It uses the
  derive-from-architecture-map path only if the SAD/field is absent.
- **`sequences`** — for a declared UI surface, draws UI-driven flows (`<user>` → `<ui>` →
  `<service>` → `<data-store>`). It adds `<ui>` to the generic participant vocabulary.
- **`tasks`** — gates the layer set by `target_surfaces`. A UI surface adds the `ui` layer (not
  auto-serialized — UI tasks can parallelize).
- **`plan-tests`** — adds the component / visual-regression / e2e-through-UI tiers when a UI
  surface is declared.
- **`review`** — the end-to-end AC trace spans UI surfaces, not only backend. A UI AC traces to a
  component / e2e-through-UI test.
