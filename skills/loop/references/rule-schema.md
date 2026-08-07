# Rule schema + score calculation + F6 specialization table

> **Reference-only.** Not a skill. `loop` PREPARE materializes check definitions from rules; this file is the single source for the rule format, the score calculation, and the F6 specialization that makes the clean-context critic work on non-spec/sad artifacts.

## Rule format (full RULE-SCHEMA)

Every rule in `run.json.criteria.rules` is expanded to full schema form (no shorthand in persistence — PREPARE expands any template shorthand before EVALUATE runs):

```json
{
  "id": "ac-testable",                       // stable id; referenced by EVALUATE/CRITIQUE
  "description": "Every spec §5 AC is testable (names an observable behavior, not a mechanism)",
  "severity": "fail",                         // fail | warn | info
  "weight": 2,                                // integer; if omitted, derived from severity (fail=2, warn=1, info=0)
  "phase": "A",                               // A | B | both (B rules activate only on phase transition)
  "check": "structural"                       // structural | content | executable | critic-f6
}
```

- `severity` — `fail` blocks (must resolve to pass); `warn` is surfaced but non-blocking; `info` is a note. Only `fail` rules gate `passed`.
- `weight` — used in score calculation; `fail` rules carry the most (default 2), so a single fail drags the score more than a warn.
- `phase` — `A` (basic structural bar), `B` (stricter quality bar, activates on A→B transition), `both` (checked in both phases). A rule with no phase defaults to `A`.
- `check` — how EVALUATE verifies the rule:
  - `structural` — a grep/count/file-exists/enum-membership test (cheap, deterministic) — e.g. «every §5 AC id appears in the coverage table».
  - `content` — a judgment probe (the critic or a content-Check Task reads and judges) — e.g. «§1 scope is unambiguous».
  - `executable` — a command (lint, schema validate, test run) — run via Bash; the rule carries the command template.
  - `critic-f6` — delegated to the clean-context critic's F6 specialization for the artifact type (see table below).

## Score calculation

```
total_weight = Σ weight over all rules active in this phase
passed_weight = Σ weight over rules with verdict pass
score = passed_weight / total_weight        # 0.0 .. 1.0
passed = (score >= threshold) AND (no fail-severity rule failed)
```

- `threshold` — phase A default 0.8, phase B default 0.9 (user-confirmed in step 3).
- A single `fail`-severity failure forces `passed = false` regardless of score (a fail is a blocker, not a weighted drag) — the weight only affects the numeric score for the stagnation/distance-to-success reporting.
- `warn`/`info` never force `passed = false`; they are surfaced in CRITIQUE but don't block.

## Default rule-sets by artifact type (derived when the user doesn't supply explicit rules)

When the user does not supply explicit success criteria, PREPARE derives a default rule-set from the artifact's owning-skill DoD. These are starting points — step 3 confirms or adjusts them.

### `spec.md` (owning skill: `specify`)
- `ac-testable` (fail, A) — every §5 AC names an observable behavior, no HTTP/status/SQL tokens.
- `ac-coverage` (fail, A) — every §5 AC id is unique and present.
- `nfr-measured` (warn, A) — every §6 NFR carries a numeric target + measurement.
- `zero-oq` (fail, B) — §8 has zero open questions (or all have owner+due).
- `scope-clear` (warn, B) — §1 scope is unambiguous (no «etc», «various», «as needed»).
- `persona-grounded` (warn, B) — persona card (if present) cites evidence (USER_CONFIRMED/RESEARCH_CONFIRMED).

### `sad.md` (owning skill: `design`)
- `arc42-complete` (fail, A) — all 12 Arc42 sections present (or explicit `<!-- N/A: reason -->`).
- `adr-gate-closed` (fail, A) — every §9 ADR marked Accepted/Rejected (none «Proposed» without an owner+due).
- `surfaces-declared` (fail, A) — frontmatter `target_surfaces` is non-empty.
- `flow-covers-ac` (fail, B) — every §5 AC maps to a §6 flow/branch/N/A.
- `risk-mitigated` (warn, B) — every §9 High risk has a mitigation.

### `api` / `openapi.yaml` (owning skill: `api`)
- `contract-valid` (fail, A, executable) — the OpenAPI document parses + validates against the schema.
- `endpoint-traced` (fail, A) — every endpoint traces to a spec §5 AC (no orphan endpoints).
- `status-matrix` (warn, A, critic-f6) — status codes follow the drift-check business-error→HTTP matrix.
- `idempotency-on-writes` (warn, B) — mutating endpoints declare idempotency where abuse-signals exist.
- `rate-limit-default` (warn, B) — abuse-signal endpoints carry 429 + Retry-After.

### `tasks.json` (owning skill: `tasks`)
- `dag-acyclic` (fail, A, executable) — `deps` topologically sorts (Kahn succeeds, no cycle).
- `ac-coverage` (fail, A) — every spec §5 AC is covered by ≥1 task's `acs`.
- `dod-testable` (fail, A) — every task `dod` contains a testable verb (J1).
- `files-hint-concrete` (warn, A) — no `«various files»`; every task names real paths.
- `risk-weighted` (warn, B) — auth/payment/migration/PII tasks carry `risk: high` (J4).
- `no-duplicate-smell` (warn, B) — no two tasks share identical `files_hint` + `layer` + overlapping `dod` (J5).

### `sequences` (owning skill: `sequences`)
- `flow-covers-ac` (fail, A) — every §5 AC maps to a flow/branch/N/A in the coverage table.
- `mermaid-valid` (fail, A, executable) — diagrams parse (mmdc render or structural lint).
- `write-persist-notes` (warn, A) — every write is a generic persist note (no SQL).
- `compensation-flow` (warn, B) — multi-step async flows have a compensation/timeout branch or explicit N/A.

## F6 specialization table (critic-f6 checks)

For artifact types the clean-context critic ([`../../_shared/critic.md`](../../_shared/critic.md)) wasn't originally designed for, PREPARE passes an F6 specialization fragment so the critic probes the right thing. The critic's F1–F5 (vector drift, size creep, defer-vs-vector, silent edits, coverage regression) apply universally; F6 is artifact-specific:

| Artifact | F6 specialization (what the critic probes) |
|---|---|
| `spec.md` | (native) implementation-detail leakage into AC; quality scenarios citing numbers absent from §6 NFR; strawman ADR options in §9. |
| `sad.md` | (native) a §6 flow contradicting an Accepted ADR; a §5 building block violating `architecture-map.md` conventions without an override note; a §11 risk mitigation that re-introduces a dropped vector. |
| `api` / `openapi.yaml` | endpoint not traced to a §5 AC; status code violating the drift-check matrix; missing idempotency on a write with an abuse signal; a request/response schema field not present in `data-model.md`. |
| `tasks.json` | a task whose `acs` reference a non-existent §5 AC; a `deps` edge pointing at a missing task id; a `dod` that violates J1 (non-testable); a compile-coupled pair not sharing the contract file in `files_hint`. |
| `sequences` | an AC with no flow/branch/N/A mapping; a diagram with HTTP verbs/status numbers/SQL (verb-first only); a multi-step async flow with no compensation/timeout branch or N/A. |

The specialization is appended to the critic dispatch prompt as the «F6 delta» (the same slot `specify`/`design` use for their native F6 — see [`../../_shared/critic.md`](../../_shared/critic.md) «How a skill dispatches it» step 2).
