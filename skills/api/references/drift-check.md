# api — drift check, report shape, reconcile, conflicts

The contract is a **derived** artifact. It takes `data-model.md` (typed shape), `sad.md` §6 sequences
(error branches, async actors), and `spec.md` §4/§5 (endpoint list, observable outcomes) → OpenAPI.
This file gives the operational detail for step 7 of the spine. It tells what the report holds and what
each drift point compares. The spine ([`../SKILL.md`](../SKILL.md)) is the source of truth for
when this runs.

## `api-sync-report.md` shape

The skill writes it to `docs/features/<slug>/contracts/api-sync-report.md` next to the YAML. It has two sections.

### Section A — field-origins table

Write one row per `(operation, schema_field)` pair. This makes every field in the contract traceable:

```
| schema_path                | origin                                        | confidence |
|----------------------------|-----------------------------------------------|------------|
| createLesson.title         | data-model.md → lesson.title (≤200)           | high       |
| createLesson.module_id     | data-model.md → lesson.module_id (FK)         | high       |
| deleteFeedback.id          | existing schema — 000012_create_feedback.up   | high       |
| listLessons.next_cursor    | derived (cursor wrapper convention)           | high       |
| publishLesson.published_at | inferred from spec §5 AC-4, no column         | low        |
```

- **high** — the field maps to a `data-model.md` column with a matching type/constraint.
- On a **legal fast-lane skip** (no `data-model.md`, no schema change — SKILL.md step 1), the
  origin is **`existing schema — <migration/DDL anchor>`**. That anchor is the live migration file
  (or DDL statement) that defines the column. The confidence scale stays the same. A column with a
  matching type/constraint in the live DDL is `high`.
- **medium** — the field derives from a spec field name with no column yet (e.g. a computed/response-only field).
- **low** — the skill infers the field from a sequence message name only. Flag it for confirmation.

A `low` row is **declared incompleteness**, not an error. It tells the team what `--reconcile`
will tighten when the model gains that column. Never hide it.

### Section B — drift findings (4-point checklist)

Each point is ✓ or ✗ with a one-line diagnostic on ✗.

1. **Endpoint ↔ data-model** *(core)* — every endpoint reads or writes ≥1 entity in `data-model.md`
   (e.g. `POST /lessons/{id}/publish` mutates `lesson.status`). On a legal fast-lane skip
   (no `data-model.md`), use this mirror instead: every endpoint reads or writes ≥1 entity in the **existing
   schema** (the live `migrations/` DDL) — the same mirror as the sad.md fallback below. Absent
   sad.md, use this fallback: every endpoint maps to a §4 user story.
2. **Error code ↔ repo error definition** *(core)* — every `code` in an `Error` response exists in
   the repo's error definitions, **checked in the form the repo uses**. Detect that form first.
   It may be a constants/enum file, an error registry, a sentinel module, or a generated table.
   Match against that form. Do **not** assume any one language or a Go-style `domain/errors.go`.
   If the repo has no central error list yet, record "no error registry found — codes are the contract's
   proposal; reconcile when the repo defines them" instead of failing the point.
3. **Validation ↔ constraint** *(core)* — `maxLength` / `pattern` / `enum` in the contract align
   with the bounded types and uniqueness/format constraints in `data-model.md`. On a legal
   fast-lane skip, they align with the **existing schema's DDL** (column types, `CHECK`s, uniqueness in the
   live migrations). On a conflict, take the **stricter** value and flag both. The human
   resolves which artifact is wrong.
4. **OpenAPI ↔ sequence** *(supporting)* — the methods, paths, and outcome branches the §6
   sequences imply match the contract. A mismatch usually means a sequence was drawn before the
   contract was finalized and never updated. Because §6 participants are generic
   (`<client>`/`<service>`/`<data-store>`), match on the **flow and its `alt`-branches**, not on
   participant names. A branch like `alt not owner` must have a corresponding error response.

A failed **core** point (1–3) pauses the run. The skill shows it to the user before writing.
**≥3 flags** of any kind in one run also pause the run. A failed
**supporting** point (4) becomes a follow-up note in the report. Resolve each finding via the
shared 4-state actions ([`../../_shared/ask-style.md`](../../_shared/ask-style.md)):

- **Accept as is** — record the mismatch as accepted (e.g. an intentionally internal entity with
  no endpoint). Continue.
- **Fix the contract** — regenerate the affected operation/schema to match the source.
- **Save as Open Question** — park it with owner + due. The field/endpoint keeps a
  `# unresolved` note until answered.
- **Fix the source first** — STOP. The contract waits for the user to correct `data-model.md` /
  the sequence (this skill never edits sources). On a legal fast-lane skip, the "source" is the
  existing schema. A mismatch there usually means the skip was NOT legal after all (the feature
  needs a column that doesn't exist). Route it to `data-model <slug>`, not to a schema hand-edit.

## Reconcile semantics (`--reconcile`)

Run this after an upstream artifact changed. Most often, `data-model.md` arrived (or was tightened)
after a thinner first pass. The reconcile pass:

1. Re-reads all inputs.
2. Tightens loose types where the model now carries a constraint (a bare `string` becomes
   `string` + `maxLength`. A free field becomes an `enum`.).
3. Refreshes the Section A confidence column (`low`/`medium` → `high` where a column now backs the field).
4. **Surfaces real drift** — any field that *had* an inferred origin but *now disagrees* with the
   model. This is the load-bearing output. Stale incompleteness becomes resolved or a genuine
   conflict. The two never get confused.

`info.version` is never bumped here. The user bumps semver explicitly with a CHANGELOG line.

## Conflict table — human in the loop

| Conflict | Skill action |
|---|---|
| Field in `data-model.md` with no story in `spec.md` covering it | Add it to the schema with a `# unused-in-spec` note in the report. Ask the user. |
| A §6 sequence references a flow that maps to no endpoint | Flag `# orphan-sequence` in the report. Ask: forgotten endpoint or internal job? |
| `spec.md` §5 constraint contradicts a `data-model.md` constraint | Take the stricter value. Flag both. The human resolves which artifact is wrong. |
| Existing `openapi.yaml` has a field absent from every source | Keep it with a `# manual-addition` note. Flag it in the report. |
| A field disappeared from `data-model.md` | Keep it in the YAML with a `# stale` note. Surface it. The human removes it from the contract or restores it in the model. |

On a **legal fast-lane skip**, the `data-model.md` rows read against the **existing schema**
instead. A field the contract needs that exists in *no* live migration is the loudest possible
flag. It means a schema change exists and the skip was illegal → stop and run `data-model <slug>`.

If ≥3 flags appear in one run, pause. List them. Ask whether to continue or to fix the sources first.

## Defaults (deviation by ADR only)

These form a fixed minimum. The skill does not invent them per feature. An `adr/*.md` overrides
any of them, and the report records "deviation by ADR-NNNN".

- OpenAPI **3.1.0** — nullability via `type: [string, null]`, never `nullable: true` (3.0 style).
- Error envelope **`{code, message, details?}`**, `code` = neutral `module.error_name` snake_case.
- **Cursor** pagination (`?after=&before=&limit=`) wrapped in `{items, has_next, has_prev, next_cursor}` — never offset.
- **URL** versioning (`/api/v1/...`) — never a `?v=2` query param.
- **BearerAuth** global. A public endpoint declares explicit `security: []`.
- `$ref` is mandatory for shared schemas. Placeholder data goes only in `example` blocks (no real PII).
- **Rate-limiting (conditional — W4).** When `spec.md §6.1` abuse cases name a rate-limit-relevant signal (spam-create, resource-exhaustion, scraping, brute-force), the contract models it. Every rate-limited operation carries a **`429 Too Many Requests`** response with a **`Retry-After`** header (seconds). It optionally carries `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers. Lifted from `vibe-saas-security` security defaults + `vibe-api-backend-patterns`. Gate it like idempotency (gated by an async-actor signal). A spec with no abuse-case signal skips this default. An operation that should be rate-limited but isn't modelled is a drift flag.
- **Business-error → HTTP status matrix (W4).** Replaces the loose «map status by class (4xx/5xx)» rule with a documented convention. Soft — an ADR overrides per-operation:
  | Business error | HTTP | Notes |
  |---|---|---|
  | conflict on a unique-violation / duplicate | 409 | not 422 — the input is valid, the state conflicts |
  | validation failure (malformed/invalid field) | 422 | not 400 — the request body parsed; semantic validation failed |
  | malformed request (won't parse, missing required param) | 400 | |
  | resource not found (and caller is authorized to know it exists) | 404 | |
  | resource not found but existence must be hidden (spec says hide-existence) | 404 | never 403 — 403 leaks existence |
  | unauthenticated (no/invalid token) | 401 | |
  | authenticated but lacking permission | 403 | only when existence is not secret |
  | rate-limited | 429 | with `Retry-After` (see above) |
  | upstream/timeout / unexpected server fault | 5xx | never leak the stack — `{code, message}` envelope only |
  The drift check flags an operation that lists a status inconsistent with this table without a justifying ADR.
