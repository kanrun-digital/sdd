---
name: data-model
model: inherit
effort: medium
agents: [explorer]
description: >
  Use to design the data model AND generate the actual forward + rollback migrations in
  one pass. Output is shippable SQL, not a plan. Triggers on "data model for {slug}",
  "schema for {slug}", "generate migrations for {slug}", "DB design + migration",
  "/sdd:data-model {slug}", "модель даних для {slug}", "схема для {slug}",
  "згенеруй міграції". Reads spec.md §5 + sad.md §5 building blocks + the §6 sequence
  diagrams. Writes docs/features/{slug}/data-model.md plus paired *.up.sql / *.down.sql
  migrations STAGED under docs/features/{slug}/migrations/ and an audit report. It does
  NOT write into the live migrations/ tree. implement promotes the staged migrations
  when the feature is actually built. Greenfield-first. Brownfield delta via
  --mode brownfield. Drift-only via --drift-only. Hard-refuse if spec.md or sad.md is
  missing. Stack-agnostic: the skill detects and FOLLOWS the repo's DB + migration
  conventions and domain layer. It imposes no DB philosophy and writes no rules file.
---

# Skill: data-model

End-to-end runner for the persistence cut: data model + migrations + drift check in one pass. Greenfield-first by default. Brownfield delta via `--mode brownfield`. Output is **shippable** — full `.up.sql` + `.down.sql`, not a plan. But it is **staged under `docs/features/<slug>/migrations/`**, never written into the live `migrations/` tree. `implement` **promotes** the staged pair into `migrations/` (with the real sequence number / timestamp) only when the feature is actually being built. This is deliberate. `data-model` is a design stage four steps before `implement`. A stray `migrate up` (a teammate's loop, CI, a deploy) must not be able to apply a half-designed schema to a real database. (Same staging discipline the drift fixes already use under `_drift/`.)

**Stack-agnostic by design — it imposes no DB philosophy and writes no rules file.** `data-model` **derives the DB + migration conventions from the architecture**: `architecture-map.md` (the migration tool/naming `survey` recorded), the `sad.md` persistence decisions (§4 strategy / §5 building blocks / §8 crosscutting), and the Accepted ADRs. It **follows** them. The live `migrations/` + schema **corroborate** them and fill anything the architecture left implicit. On a greenfield repo with no architecture signal, it **confirms each schema choice with the user** (Socratic) instead of defaulting to a house style. What it applies regardless of stack is migration **safety** (staging, reversibility, FK indexes, zero-downtime decomposition, no-PII). It never takes a stance on `updated_at` vs not, hard vs soft delete, UUID vs sequence, or whether `CHECK` constraints are allowed. The size matrix (→ [`../_shared/size-matrix.md`](../_shared/size-matrix.md)) governs how much you produce. The aggregate-roots dialogue uses [`../_shared/ask-style.md`](../_shared/ask-style.md).

`data-model.md` prose follows `artifact_language` — SQL, table/column identifiers, headings and frontmatter stay English → [`../_shared/artifact-language.md`](../_shared/artifact-language.md).

## Owner

Backend Lead.

## Inputs

- `<slug>` — feature slug.
- **Gate (hard refuse if missing):** `docs/features/<slug>/spec.md` (entities live in §5 acceptance criteria) and `docs/features/<slug>/sad.md` (entity candidates: §5 building blocks — the persistence containers — + the §6 persist notes). Missing → «run `specify` / `design` first».
- Optional: the sequence diagrams in `sad.md §6` — each `writes/reads <entity>` note is an index candidate (one index per query, justified).
- (Expected) `sad.md` frontmatter `target_surfaces` — context for which containers persist what. **Absent or empty → warn** («surfaces undeclared — re-run `design`, or proceeding as `backend-service`») **and treat as `[backend-service]`** (→ [`../_shared/surfaces.md`](../_shared/surfaces.md)).
- **Convention source:** `docs/architecture-map.md` §Migrations (from `survey`) + the `sad.md` persistence decisions (§4/§5/§8) + Accepted ADRs — the migration tool/naming + the DB approach are **derived from here**, not invented (the map also gives module layout, saving a re-scan). For **drift detection** specifically, `explorer` still reads the **actual domain layer** (the map gives layout. Drift needs the real struct/field source). Stack-agnostic — no hard-coded path or language.
- (Optional, project-level override) `docs/.skill-context/sdd-data-model/SKILL.md` — if it exists, read it and apply its rules to all outputs. On conflict, the overrides win → [`../_shared/skill-context.md`](../_shared/skill-context.md). Absent → no-op (defaults apply).

## Conventions — detect and follow (stack-agnostic)

`data-model` imposes **no** DB philosophy. For each topic below it **follows the architecture's decision** — `architecture-map.md` §Migrations + the `sad.md` persistence decisions + Accepted ADRs — corroborated by the repo's existing migrations/schema. On a greenfield repo with no signal it **confirms the choice with the user**. It never legislates a house style.

| Topic | How `data-model` decides |
|---|---|
| Naming (tables / columns) | Follow the repo's convention (detected from existing migrations + schema). Greenfield → confirm. |
| PK strategy | Follow the repo (UUID / bigint-identity / sequence / composite — whatever it uses). Greenfield → confirm. |
| Audit columns (`created_at` / `updated_at` / …) | Match the repo's pattern. Greenfield → confirm. No stance imposed either way. |
| Delete strategy (hard / soft / status) | Match the repo. Greenfield → confirm. |
| Constraints (`CHECK` / `TRIGGER` / DB `DEFAULT`) | Use them **iff the repo does**. Never add or forbid them by fiat. |
| String / JSON types | Match the repo's norms (`VARCHAR(N)` / `TEXT` / JSON). Greenfield → confirm. |

What it **does apply regardless of stack** — migration **safety**, not DB philosophy:

| Mechanic | Why (stack-agnostic) |
|---|---|
| **Staged** as `docs/features/<slug>/migrations/<NN>_<verb>_<entity>.up.sql` + `.down.sql` (NN = feature-local ordinal), promoted by `implement` (real number/timestamp assigned at promote-time) | Keeps the live tree free of half-designed schema. Late numbering avoids early-grab collisions. |
| Idempotent DDL where the tool supports it (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING` on seeds) | Re-running a partially-applied migration does not error. |
| A `.down` for every `.up` (full reversibility) | Rollback is always possible. |
| An index on every FK + one index per real query (from the sequences) | Universal performance hygiene — no "just in case" indexes. |
| Breaking change on an existing table → expand → backfill → contract | Zero-downtime, any DB. |
| No real-looking PII in seeds (`example.test`) | Safety. |

## Protocol

1. **Prereq check (hard).** Both `spec.md` and `sad.md` present, else refuse with a pointer to the missing one.
2. **Derive conventions from the architecture (read-only — never write a rules file).** Read **`architecture-map.md` §Migrations** (the tool/naming `survey` recorded), the **`sad.md` persistence decisions** (§4 strategy / §5 building blocks / §8 crosscutting), and the **Accepted ADRs** **first**. They choose the migration tool/naming + the DB approach (PK / audit / delete / constraints). **Corroborate** with the live `migrations/` folder + schema (Explore or `ls`) for anything the architecture left implicit — e.g. statement-per-file rules (golang-migrate's transaction-per-file) or the next sequence value. Record the migration naming as a **promote-time hint** in the audit report (e.g. «sequential, next ≈ `000023` — `implement` assigns the real number at promotion, since another feature may promote first»). On a **greenfield** repo with no architecture signal, confirm the schema choices with the user (steps 4–6). Do not default to a house style. **Do not pick a final number. Do not write into the live `migrations/`. Do not impose a convention the architecture/repo doesn't use.** Staging happens in step 9, promotion in `implement`. Flag any divergence (architecture vs repo) in the report.
3. **Read prereqs in order:** spec §5 (entity candidates from AC) → sad §5 building blocks (the persistence containers — which container owns which data) → `sad.md §6` sequences (each `writes/reads <entity>` note → an entity + index candidate) → (optional) the Explore-discovered domain layer for a struct-vs-DDL map.
4. **Aggregate roots.** Ask (or infer from AC) which aggregate roots own what. Without explicit aggregates the FK graph turns into a hairball. Phrase per [`../_shared/ask-style.md`](../_shared/ask-style.md).
5. **PK strategy.** Follow the repo's detected PK convention. On greenfield (or if an AC demands a specific PK like a lookup slug), confirm with the user — UUID, bigint-identity, sequence, composite, whatever fits. No default imposed.
6. **Columns + constraints** per entity, **matching the repo's conventions**. Use string/JSON types per the repo's norms (`VARCHAR(N)` sized from AC validation limits / `TEXT` / JSON, as the repo does). Set audit columns (`created_at` / `updated_at` / none) per the repo's pattern. Add `CHECK` / DB `DEFAULT` / triggers **iff the repo uses them**. Put `<!-- TBD -->` where the choice is honestly undecided. On greenfield, confirm these with the user.
7. **Indexes per query.** Each sequence note becomes one index candidate. Discard candidates with no concrete query. Print a "Query it serves" justification column.
8. **Write `docs/features/<slug>/data-model.md`** from [`./templates/data-model.md`](./templates/data-model.md): ER Mermaid (clean ordered block) + entity tables per aggregate + indexes table. **Check the `erDiagram` per [`../_shared/mermaid-check.md`](../_shared/mermaid-check.md)** (render-parse with `mmdc` if available, else the structural lint — valid cardinality glyphs + `type name` attribute lines). Fix issues before continuing.
9. **Generate migration files — STAGED in the feature folder, not the live tree.** A run that finds **no schema change** legitimately produces a minimal `data-model.md` with **zero** staged migrations. That `data-model.md` documents the existing entities the feature touches. It is a valid outcome, not a failure. Note that `api` would also have accepted the fast-lane skip (→ [size-matrix fast lane](../_shared/size-matrix.md)). Write the pairs into **`docs/features/<slug>/migrations/`** with a **feature-local ordinal** name (`01_create_<entity>.up.sql` + `.down.sql`, `02_…`) that preserves intra-feature order. The SQL is full and shippable. Only the location + the final number differ from a live migration. **Never write into the repo's live `migrations/` here.** `implement` promotes these files when it runs the `layer: migration` task. It assigns the real sequence number / timestamp per the convention detected in step 2, in ordinal order. The SQL content rules are unchanged:
   - **Greenfield:** one create-`<entity>` `.up.sql` + `.down.sql` per entity (or per small aggregate). `IF NOT EXISTS` everywhere. `ON CONFLICT DO NOTHING` on seeds.
   - **Existing-table index:** use the concurrent, non-blocking form, and warn that the file must contain only that one statement **if your migration tool wraps each file in a transaction** (e.g. golang-migrate).
   - **New NOT NULL on existing table / rename / drop:** emit the 3-step expand→backfill→contract sequence (separate ordinal files). The user reviews the backfill SQL.
10. **Seeds (3 buckets).** Bootstrap (deterministic hardcoded UUID v7) → first migration. Lookup data → separate migration with `ON CONFLICT DO NOTHING`. Test fixtures → **NOT** in `migrations/`. Generate them in the form the repo uses (factory functions / fixtures / builders). Document them under "Test fixtures". **PII guard (hard):** no real-looking email/name/phone in any seed — use `admin@example.test`, `user-<uuid>@example.test`, `Test User`.
11. **Drift detection (always — `--drift-only` short-circuits here).** If the Explore subagent found a domain layer, map each field to a column. Report `field-without-column` / `column-without-field` / `type-mismatch` / `nullability-mismatch`. Auto-propose fix migrations under `_drift/` for the user to review.
12. **Self-check (4 mandatory, stack-agnostic).** Naming matches the **repo's** convention. **Down reversibility**: every CREATE has a DROP, every ADD COLUMN a DROP COLUMN, every CREATE INDEX a DROP INDEX. **FK indexes**: every `REFERENCES other(id)` has an index on the FK column. **Convention adherence**: the schema follows the repo's detected conventions — flag any deliberate divergence in the report, never silently impose a house style. Any failure → fix or surface, never silent-commit.
13. **Audit report** `docs/features/<slug>/_audit/data-model-<date>.md`: the **staged** migration files (their `docs/features/<slug>/migrations/<NN>_*` paths), the **promote-time convention hint** (e.g. «repo is sequential, next ≈ `000024` — `implement` assigns the real number at promotion»), convention deviations, drift findings, breaking-change decompositions, every `<!-- TBD -->`. State plainly: «migrations are staged — not yet in the live `migrations/` tree. `implement` promotes them». Next stage `api <slug>`.
14. **Propose commit + handoff.** Commit message: `data-model: <slug> (data-model.md + staged migrations)`. Then **emit the stage-handoff block** per [`../_shared/handoff.md`](../_shared/handoff.md). Fill *What I did* + *Review* (`data-model.md`, staged `migrations/`). Fill *Run next* as follows. **Resolve the next stage per `.route`** (the Routes table in [`../_shared/size-matrix.md`](../_shared/size-matrix.md)). Forward target: `/sdd:api <slug>`. `api`'s N/A condition = **no contract change** (no new/changed endpoint, event, or public signature). Then skip to `/sdd:tasks <slug>`. On `quick`: auto-skip with the reason + inverted `↳ or`. On `standard`: offer the `↳ or`. On `full`: no skip line.

## Definition of Done

- `data-model.md` exists with ER + every entity + every index carrying a query justification.
- For every entity/change, a matched `.up.sql` + `.down.sql` pair exists **under `docs/features/<slug>/migrations/`** (staged, feature-local ordinal names) — **nothing was written into the live `migrations/` tree** (that's `implement`'s promotion step). The SQL still follows the repo's detected convention.
- All 4 self-checks pass.
- Audit report written (with the staged paths + the promote-time number hint). Drift report (with `_drift/*.sql`) if drift was detected.
- The step-12 4-mandatory check + step-11 drift detection are this skill's **structural self-check** ([`../_shared/self-check.md`](../_shared/self-check.md)). Its result is reported in the handoff.

## Anti-patterns

- **Imposing a DB philosophy the repo (or the user) didn't ask for** — forcing UUID v7 / hard-delete / no-`updated_at` / no-`CHECK` on a repo that does otherwise, or writing a `.claude/rules/migrations.md` to legislate one. `data-model` **detects and follows** the repo's conventions. If a repo uses `CHECK` constraints or `updated_at`, match it.
- **Index "just in case"** with no concrete query. Each index costs writes.
- **One mega-migration with 5 ALTERs** — rollback becomes all-or-nothing. Split.
- **DROP COLUMN before deploying new code** — breaks running pods between phases. Always 3-step.
- **Real-looking PII in seeds.** Use `example.test`.
- **Writing the migration into the live `migrations/` tree at design time.** That drops a half-designed, runnable schema where a stray `migrate up` (CI, a teammate's loop, a deploy) can apply it before the feature is built or reviewed. It also grabs a sequence number early, colliding with other in-flight features. Stage under `docs/features/<slug>/migrations/`. `implement` promotes it (with the real number) when the code that needs it is actually being written.
- **Silently switching the repo's migration naming convention.** Detect, follow, and flag in the report.
- **Live DB introspection with no offline fallback** — CI has no DB credentials. Parse the SQL files.

## References & template

- [`./templates/data-model.md`](./templates/data-model.md) — output structure for the design doc.
