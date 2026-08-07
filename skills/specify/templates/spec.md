---
status: Draft
owner: "<feature owner>"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "<today YYYY-MM-DD>"
feature_size: "<from classify-size: XS/S/M/L/XL>"
---

# Spec — <slug>

<!-- instruction: one-line links to inputs used.
> **Glossary:** [CONTEXT](./CONTEXT.md) (if present)
> **Reference module / docs / channels used:** name the specific paths/queries read in step 5, or «None — only the interview + CONTEXT».
> **Product memory read (optional):** if `.vibe/marketing/{STRATEGIC_DNA,OFFER_MATRIX,JOURNEY_ARCH}.md` (or a `.vibe/clients/*/marketing/` variant) was read in step 1, list the files here. Every §1/§2/§3/§4 claim seeded from them carries a `[Fact: PRIOR_ARTIFACT — <file>]` tag inline (the evidence label from [`../references/ideation.md`](../references/ideation.md)).
Do not mention competitive-research or ideation scratch work here — those inform §1, they are not inputs to cite. -->

## 1. Context

<!-- instruction: 3–4 paragraphs + a persona card.
¶1 What we're solving — the concrete problem from the interview, for whom (the named persona from the persona card below; cite the segment by its card name, not a bare «user»).
¶2 Why now — the trigger (incident, contract, deadline, strategic shift).
¶3 The committed approach — 1–2 sentences. For M+/L this is the recommendation from the ideation pass; for XS/S it's the obvious direction from the deep-dive. Every claim in ¶3 carries an evidence tag at medium/hard depth (`USER_CONFIRMED` / `RESEARCH_CONFIRMED` / `PRIOR_ARTIFACT` / `ASSUMPTION` / `NEEDS_PROOF`) — see [`../references/ideation.md`](../references/ideation.md).
¶4 (optional) Traceability context — reference-module patterns or quoted sources, AND the slot where critic `Override` resolutions emit «Decision override: <headline> — rationale: <reason>» bullets.
This section is WHAT + WHY, not HOW. Do NOT name a concrete datastore / broker / framework / library here — that belongs to design.

**Persona card** (attach after ¶4, one per distinct user segment the feature serves; at `easy` depth only `JTBD` + `Confidence` are required, the other fields stay empty unless they surfaced in the interview):

### Persona — <segment name>
- **JTBD:** <the job this segment hires the feature to do — a verb + outcome, not a role>
- **Core fear:** <what going wrong would cost them — the failure they're trying to avoid>
- **Hidden objection:** <the unspoken reason they wouldn't adopt this even if it works>
- **Trust proof needed:** <what evidence would make them believe the claim — case, number, demo, social proof>
- **Validation evidence:** <source backing the JTBD/fear/objection — interview quote, research row, analytics, or `none yet`>
- **Confidence:** high | medium | low

A persona with `Confidence: high` MUST carry non-empty `Validation evidence` (critic F9). Roles in the persona card match the CONTEXT glossary exactly — no invented `user`/`admin`. Source: trimmed from `vibe-customer-neuromodel`'s 13-field NeuroModel card. -->

## 2. Goals

<!-- instruction: 2–3 measurable strategic outcomes as a bullet list. Each is a manifestation of the committed approach (§1 ¶3). No raw numbers here — numbers live in §7 KPIs. -->

## 3. Non-goals

<!-- instruction: 3–4 explicit non-goals, each one sentence + a reason. Keeps scope honest. -->

## 4. User stories

<!-- instruction: ≥5 user stories, no upper cap. Enough to cover every role in the CONTEXT glossary + every goal in §2. Format:

### US-NN: <3–6 word action title>
**As a** <role from CONTEXT glossary>
**I want** <action>
**So that** <observable benefit>

Roles ONLY from the glossary (no invented `user`/`admin`). Each US is covered by ≥1 AC in §5. -->

### US-01: <title>

**As a** <role>
**I want** <action>
**So that** <benefit>

## 5. Acceptance criteria

<!-- instruction: ≥1 AC of EACH of the 5 coverage types, no upper cap. Format:

### AC-NN (US-XX) — <coverage type>
**Given** <business preconditions: actor role, state of their domain objects, prior events>
**When** <business action from the actor's perspective>
**Then** <observable business outcome: actor sees X / system blocks Y and explains Z / system records W>

AC = business-observable outcome from the actor's perspective. NOT how the system does it.

FORBIDDEN in AC text (zero tolerance — critic F6 + pre-write regex):
- HTTP verbs (GET/POST/PUT/PATCH/DELETE)
- URL paths (/things, /things/{id}, /api/v1/...)
- status-code numerics in the body (200/201/400/401/403/404/409/5xx)
- error-code strings matching `[a-z_]+\.[a-z_]+` (e.g. order.not_owner)
- JSON fragments / payload bodies ({field: "value"})
- SQL / DB constructs (UNIQUE, FK, raw INSERT/SELECT/UPDATE, constraint names)
The technical mapping for these lives in `api` + `decide-adr`. Here: only what the actor observes.

Allowed: glossary roles, domain-invariant NAMES as natural-language phrases («no published lessons», «unique sequence per course»), glossary domain objects.

The 5 mandatory coverage types (≥1 each):
1. happy — actor does the main flow → system records the outcome and confirms.
2. error — actor submits invalid input → system blocks it and explains the reason in plain language.
3. authorization — actor lacks permission → system denies access OR hides existence (rationale in business terms).
4. domain invariant — actor violates a named invariant → system blocks and names the invariant plainly.
5. cross-context — actor's action depends on state in another bounded context → system enforces the cross-context rule.

Tag each AC with its US-NN. Concurrent edge → add as AC-NNb, still in business language. -->

### AC-01 (US-01) — happy path

**Given** an authorized <role> owns a draft <domain-object>
**When** the <role> attempts to publish the <domain-object>
**Then** the system records it as published and confirms to the <role>

### AC-02 (US-01) — domain invariant violation

**Given** an authorized <role> owns a draft <domain-object> with no child <sub-objects>
**When** the <role> attempts to publish it
**Then** the system blocks the publication and tells the <role> that at least one <sub-object> is required first

## 6. Non-functional requirements

<!-- instruction: table, recommended floor (not a cap). Targets are NUMERIC (≤250ms, ≥30 req/s, 99.9%) — no adjectives («fast», «high»). Measurement = a concrete production metric. Unknown number → TBD with owner+due in §8, never «fast». -->

| Aspect | Target | Measurement |
|---|---|---|
| Latency p95 <write operation> | ≤ <N ms> | <metric source> |
| Latency p95 <read/list operation> | ≤ <N ms> | <metric source> |
| Throughput | ≥ <N req/s> per instance | smoke test in CI |
| Availability | 99.X% | monthly SLO window |
| <Concurrency / Accuracy> | <safety guarantee> | <how enforced> |

## 6.1 Security / privacy

<!-- instruction:
- Data classification: public / internal / confidential / regulated (one word + 1-sentence rationale).
- Personal data touched: none, OR list new fields with type + sensitivity.
- AuthZ/AuthN impact: which capabilities / permission checks are added, which checks run (e.g. «repo always filters by the caller's org»). Stay surface-neutral — no endpoint/route language here; `design` derives the surfaces and `api` the endpoints.
- Abuse cases (3–5): cross-tenant access, draft/data leak, injection through URL/text fields, spam-create with a rate limit, optional token misuse — each with the business response (deny vs hide-existence; rationale, not status codes).
- Security review verdict: Required (M+ / new authz boundary / new PII) or N/A with a concrete reason. -->

- **Data classification:** <...>
- **Personal data touched:** <...>
- **AuthZ/AuthN impact:** <...>
- **Abuse cases:**
  - <cross-tenant>: <business response>
  - <data-leak>: <how hidden>
  - <spam>: rate limit <N per minute per user>
- **Security review:** <Required / N/A with reason>

## 7. Metrics / KPIs

<!-- instruction: ≥3 KPIs, no upper cap, each baseline → target with a timeframe. baseline=0 OK for a new feature; baseline=TBD requires a measurement plan inline. -->

- **<metric 1>** — baseline: <...>, target: <... within ... days>.
- **<metric 2>** — baseline: <...>, target: <...>.
- **<metric 3>** — baseline: <...>, target: <...>.

## 8. Open questions

<!-- instruction: 2–4 open questions. Format: `- [ ] <question>? Default now: <X>. — owner: <name/role>, due: <date or stage trigger like "before /sdd:tasks">`. Every question has an owner + due — a lone «TBD» is an anti-pattern. §8 is for genuine decision forks (need a call before X); accepted uncertainties with a mitigation live in §9; stated-but-unconfirmed inputs live in §10. -->

- [ ] <question>? Default now: <...>. — owner: <name/role>, due: <date or stage>
- [ ] <question>? — owner: <name/role>, due: <date or stage>

## 9. Risks

<!-- instruction: accepted uncertainties with a mitigation — NOT genuine open questions (those stay in §8), NOT unconfirmed inputs (those go to §10). Format, one row per risk:

- [ ] **<risk headline>** — mitigation: <X>. — severity: critical | high | medium | low | info — owner: <name/role>, due: <date or stage trigger>

Required fields per row: headline, mitigation, severity, owner, due (critic F5 floor). Severity taxonomy from `vibe-task-briefs` (critical/high/medium/low/info). The optional confidence tag (`Verified` / `Hypothesis` / `Weak`, from `vibe-toc-constraint-diagnosis`) may trail the row for high-stakes risks — omit when obvious.

Seed sources: the `devils-advocate`'s sharpest vector (already mirrored in §6.1 abuse cases — duplicate the *product-level* risk here, the security angle lives in §6.1); analyst `−` matrix cells from the ideation pass; `researcher` gaps flagged `NEEDS_PROOF`. A risk with severity `critical`/`high` MUST have a concrete mitigation, not «monitor».

Floor: 0 rows is valid when the ideation suite was skipped (easy depth) and the deep-dive surfaced nothing material — write `<!-- N/A: no material risks surfaced — easy depth, deep-dive only -->` rather than fabricate. At medium/hard, ≥1 risk row is expected. -->

- [ ] **<risk>** — mitigation: <X>. — severity: high — owner: <name/role>, due: <date or stage>

## 10. Assumptions

<!-- instruction: stated-but-unconfirmed inputs that the spec depends on — NOT open questions (§8) and NOT risks with a mitigation (§9). This is where the easy-depth «assumptions ledger» and the medium/hard `ASSUMPTION`-tagged research claims land and persist (previously a transient runtime artifact). Format:

- **<assumption>** — source: user | research | assumption | prior-artifact — confidence: high | medium | low

Required fields per row: the assumption statement, source, confidence (critic F5 floor). Source taxonomy from `kanrun-artifact-contracts.md`: `user` = stated in the interview; `research` = `researcher`/web output; `assumption` = inferred by the skill from context (the easy-depth ledger); `prior-artifact` = read from a memory file or upstream doc. Confidence drives the critic F9 provenance check.

Seed sources: the easy-depth assumptions ledger; `researcher` rows tagged `ASSUMPTION`/`NEEDS_PROOF` (from the evidence labels in [`../references/ideation.md`](../references/ideation.md)); any §1 ¶3 claim tagged `ASSUMPTION`. An assumption with `confidence: high` is a candidate for promotion to §1/§2 fact once its evidence arrives.

Floor: 0 rows is valid when every spec input is `USER_CONFIRMED`. At `easy` depth ≥1 row is expected (the chosen-approach assumption if nothing else). -->

- **<assumption>** — source: assumption — confidence: medium
