# Prevention Point Registry — the extraction protocol + format

> **Reference-only.** Not a skill. `evolve` step 2 builds a flat registry of every independent prevention point mined from the evidence (`_fixes/`, `_review/`, §9/§10, ADRs). This file is the single source for the extraction protocol (how to read each evidence type) and the registry format. The registry is the primary input for step 6 gap analysis.

## The format

A flat table — one row per **independent prevention point**, NOT per evidence file. A single fix-record with 3 prevention points produces 3 rows. A prevention point targeting 2 skills appears once with both listed (step 6 checks EACH skill independently).

```
| # | Source evidence                             | Prevention Point (specific action)                                 | Target Skill(s)              |
|---|---------------------------------------------|--------------------------------------------------------------------|------------------------------|
| 1 | _fixes/2026-07-15-null-relation.md          | Null-check optional DB relations before accessing nested props      | implement, data-model |
| 2 | _fixes/2026-07-15-null-relation.md          | When fixing a null-relation error, check ALL usages of that relation in the same file | fix |
| 3 | _fixes/2026-07-20-unhandled-promise.md      | Wrap async API-layer calls in try/catch; log the rejection          | implement |
| 4 | _review/2026-07-22-checkout-review.md (F2)  | Migration tasks must include a down-path that drops the new column  | data-model, tasks |
```

**Critical rules:**
- **One prevention point = one row.** Do NOT merge independent actions into one vague summary. «Handle nulls and promises properly» is invalid — it must be two rows.
- **Preserve concrete formats/patterns verbatim.** If the evidence specifies an exact command, syntax, assertion, or template, include it verbatim in the prevention point. Do not paraphrase it into a vague description.
- **Target the right skill(s).** A prevention point about *writing* null-checks targets `implement`. One about *fixing* a null-relation recurrence targets `fix`. One about *validating* a schema has no nullable-without-default targets `data-model`. The same underlying lesson may target multiple skills — list all. Step 6 checks each independently.
- **Each source is traceable.** The Source column carries the evidence path (+ finding id for review-records, e.g. `(F2)`).

---

## Extraction protocol — fix-records (`_fixes/*.md`)

A fix-record (`fix` output) has: `triage` (regression/spec-bug/gap), `acs`, symptom, root cause, the pinning test, the spec patch, follow-ups. Extract prevention points from:

1. **Root cause** — the *mechanism* that let the bug slip. A root cause of «the handler accessed `order.discount.id` without checking `order.discount` is nullable» yields a prevention point for `implement` («null-check optional relations before nested access»). A root cause of «the AC said 'applies a discount' without specifying 'at most once'» yields a prevention point for `specify` («ACs for additive operations must state the multiplicity bound»).
2. **The pinning test** — the *level* the bug needed (unit/integration/e2e). If the bug needed an integration test but only a unit test existed, that's a prevention point for `plan-tests` («apply-discount idempotency needs an integration tier, not just unit»).
3. **The spec patch** (triage b/c — spec-bug/gap) — the *wording gap*. If the AC was patched from «applies a discount» to «applies a discount at most once per order», that's a prevention point for `specify` («ACs for operations with a natural multiplicity bound must state it — at most once, exactly N, at most N per window»).
4. **Follow-ups** — each independent follow-up is a candidate prevention point (but only if it is a *generalizable* lesson, not a one-off todo).

**Trap — recurrence:** if the `_fixes/` dir shows that the same symptom was fixed before, that is a recurrence. The previous fix's prevention point didn't land. Extract a *strengthened* prevention point (the old one was too weak). Note the recurrence in the Source column.

---

## Extraction protocol — review-records (`_review/review-*.md`)

A review-record (`review` output) has: scope, findings (each with a verdict Fix/Defer/Not-an-issue + a citation), the gate result. Extract prevention points from:

1. **Findings with verdict `Fix`** — each is a concrete defect the reviewer caught. The *class* of defect (SQL-injection risk, missing index, N+1 query, secret logged, a11y violation) is the prevention point. Target the skill that *produced* the code (usually `implement`). Sometimes target the skill that *designed* it (`api` for a missing rate-limit, `sequences` for a missing compensation flow).
2. **Recurring findings across reviews** — the same finding class in ≥2 review-records is a systemic skill gap (the skill keeps producing the defect). Weight these highest in gap analysis.
3. **Findings with verdict `Defer`** — each deferred finding is a known debt. If it recurs, it is a prevention point (the defer didn't resolve the underlying skill gap).
4. **Gate result `CHANGES REQUESTED`** — a review that blocked ship is strong evidence. Its Fix-verdict findings are high-priority prevention points.

**Trap — finding id ≠ prevention point:** a review finding `F3: N+1 query in order-discounts loop` is ONE finding but may yield ONE prevention point («avoid N+1 in loop-bound repo calls» → `implement`). Don't over-split a single finding into multiple prevention points unless it names genuinely independent actions.

---

## Extraction protocol — `sad.md` §9 Risks + §10 Assumptions

§9 Risks: each High/Medium risk with a mitigation that a skill should enforce is a prevention point. Target the skill that owns the risk's domain (usually `implement` or `design`). §10 Assumptions: an assumption that, if violated, breaks the design is a prevention point for the skill that *depends* on it. Target the skill whose artifact encodes the dependency.

These are weaker evidence than fix/review-records (they are *anticipated* risks, not *observed* defects). Weight them lower in gap analysis. Extract a prevention point only when the risk/assumption names a concrete skill behavior.

---

## Extraction protocol — ADRs (`adr/NNNN-*.md`)

An Accepted ADR's decision is a hard constraint. Extract a prevention point when the ADR mandates a behavior a skill should enforce («all writes are idempotent via key X» → `implement`, `api`. «soft delete only, no hard deletes» → `data-model`, `implement`). Weight these high — an ADR is a deliberate, recorded decision, not an observed defect.

ADRs are also the source for the **stale-rule check** (step 4). If a skill-context rule contradicts an Accepted ADR, that is a Case B conflict for the user to resolve.
