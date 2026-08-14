# Review dimensions + dispatch

The independent review (step 2) probes the feature diff along these dimensions. For a small change, one [`reviewer`](../../../agents/reviewer.md) pass covers them all. For a large diff, fan out one reviewer per dimension. Then merge findings.

## Stage 1 — does it do what the spec says (the gate that can block ship)

- **AC compliance.** For every AC the change claims (the `SDD-AC` trailers / `tasks.json` `acs`), check two things. Does the code actually produce the business-observable outcome the AC names? Is there a test that asserts *that outcome* (not a tautology)?
- **End-to-end use-case + AC trace (the backstop).** Take the **whole** spec **§4 user-story set + §5 AC set** — **not only the ACs the diff claims** — and trace both through the chain. **Use-case level:** every §4 user story has ≥1 AC (specify's use-case floor) and a §6 sequence flow (sequences' use-case pass). **AC level:** **spec §5 → `sad.md` §6 sequence (a flow or branch shows it) → `data-model.md` (the schema supports it) → `contracts/openapi.yaml` (an endpoint/event exposes it) → `tasks.json` (a task claims it) → implement (code + a test asserts it)**. **The trace spans every surface declared in `sad.md` `target_surfaces`, not only the backend.** For a UI surface (`web-frontend` / `mobile-app` / `desktop-app`), a UI AC reaches a `ui`-layer task + a **component / e2e-through-UI** test. A UI-driven §6 flow (`<user>` → `<ui>` → `<service>`) shows it. A UI AC that lands only a backend test is a gap. The §5 set includes any AC carrying an `<!-- added-by-fix -->` marker. Trace it like every other AC. It needs full chain coverage, with the fix's pinning test as its minimum, not its ceiling. Flag anything that **drops out anywhere**. Examples: a user story with no AC or no flow. An AC missing a flow, a task, a test, or code. Each per-stage gate guards one link (specify's §5 5-type + use-case floors, sequences' use-case + AC→flow coverage, plan-tests' AC→test, tasks' AC→task). `review` is the **end-to-end backstop**. It catches anything that slipped *between* links and never reached the diff at all.
- **Contract fidelity.** Does the change honour `data-model.md`, `contracts/openapi.yaml`, and the Accepted ADRs (e.g. the audit-in-transaction decision)? Or does it quietly diverge?
- **ADR conformance (per-ADR citation).** For **each** Accepted ADR in `docs/features/<slug>/adr/`, the reviewer cites a `file:line` in the diff that realizes the decision. Or the reviewer marks it `N/A: <reason>` (e.g. an ADR about a different module). An Accepted ADR with **no** realizing code location and no N/A reason is a stage-1 finding. The team made an architecture decision that never reached the code. Lifted from the cross-file-consistency discipline in `code-reviewing`. (One ADR may be realized by multiple sites. Cite at least one.)

A stage-1 finding means the feature does not yet meet its spec. It blocks ship until fixed or explicitly de-scoped (a spec change with the owner in the loop). A user story or AC that dropped out of the chain is a stage-1 finding. This holds even if no line of the diff mentions it. An Accepted ADR that the diff silently violates is a stage-1 finding.

## Stage 2 — is it good code (quality, usually non-blocking)

Stage-2 dimensions are quality findings. The default resolution path is still Fix / Defer (owner+due) / Not-an-issue. A stage-2 finding with **critical** severity (see Severity below) is promoted to **stage-1 (blocking)**. A secrets-leak or a resource-in-loop is not "non-blocking quality".

- **Conventions.** Matches the repo's patterns for each layer (error handling, wiring, naming, module boundaries).
- **UI reuse (for a UI surface).** Composes the existing design system / components / tokens / styling (`architecture-map.md` §Frontend) rather than reinventing. Flag from-scratch UI that duplicates an existing primitive. Also flag UI that introduces a second styling system.
- **Error + edge handling.** Are the spec's error / authorization / invariant criteria handled, not just the happy path? Concurrency, empty/oversized input, idempotency where the contract requires it.
- **Performance / hot-path.** Does the diff introduce a hot-path risk? Probe it (6-domain checklist lifted from `vibe-saas-performance`). **API** — N+1 query, serial awaits where parallel is safe, missing index for a new filter/sort/join, unbounded query (no pagination/limit), expensive third-party call in the request path. **DB** — query in a loop, full-table scan on a growing table. **Frontend** (UI surface) — bundle-size regression, hydration on cold cache, layout shift. **Cache** — stale-data risk, missing invalidation on a mutation. **Background** — slow non-interactive work left in the request path. **Cost** — repeated LLM/API calls, overfetching. If `spec.md §6` carries a numeric NFR the diff's hot-path touches, name the budget risk explicitly (e.g. «§6 says p95 ≤ 250ms. The per-row external call in this loop breaches it at N>10»). This is a **static risk flag**, not a load-test run (that's plan-tests / ship).
- **Security (16-item OWASP-derived checklist).** Replaces the old 3-bullet check. Lifted from `security-auditor`. For the diff's new/changed surfaces, probe:
  1. **SQL injection** — string-concatenated query, unsafe ORM raw, dynamic `ORDER BY`/column names.
  2. **XSS** — stored/reflected/DOM: unescaped user input rendered to HTML, `dangerouslySetInnerHTML`, `innerHTML`.
  3. **CSRF** — state-changing endpoint without a CSRF token / SameSite cookie (for cookie-auth).
  4. **Authentication** — verify session/JWT actually checked. Also probe remember-me / reset-token strength.
  5. **Authorization (incl. privilege escalation)** — every protected record gets an ownership/tenant check. Admin routes are separately *authorized*, not just *authenticated* (lifted from `vibe-saas-security`).
  6. **Input validation** — at the boundary. Reject malformed before business logic.
  7. **Cryptography** — weak/rolling hash, ECB, homebrew crypto, predictable token.
  8. **Dependency CVEs** — new dep with a known advisory. Also pin drift.
  9. **Rate limiting / DoS** — expensive endpoint unbounded (greedy regex, unbounded parse, expensive crypto on user input).
  10. **CORS** — wildcard `*` with credentials, reflective origin header.
  11. **Security headers** — CSP / HSTS / X-Frame-Options present where applicable.
  12. **Hardcoded secrets** — tokens, keys, passwords in source or config-not-ignored.
  13. **SSRF** — user-controlled URL fetched server-side (webhook config, image proxy, import-from-URL).
  14. **Insecure design** — missing threat model on a new trust boundary, business-logic flaw (e.g. negative-quantity order).
  15. **Software/data integrity** — unsafe deserialization, unsigned webhook, CI-runnable tampering.
  16. **Security logging & monitoring** — audit-relevant action not logged. Auth-failure spike not alertable.

  **Automatic severity (from `code-reviewing`)** — these patterns carry pre-assigned severity, no judgment needed:
  | Pattern | Severity |
  |---|---|
  | Secret/PII logged (token, password, email in plaintext) | critical (→ stage-1) |
  | Empty catch — error swallowed without logging | major |
  | External call (API/DB) with no logging on failure | major |
  | Missing correlation/request ID in a request handler | minor |
  | Heavy resource (DB pool / browser / model client) created inside a loop or per-request handler | critical (→ stage-1) |
  | Same heavy resource class instantiated in multiple files without a shared instance | major |
  | Resource opened never closed (connection, file handle, cursor) | major |
- **Accessibility (conditional — runs iff `sad.md` `target_surfaces` declares a UI surface).** Lifted from `vibe-accessibility-audit`. For UI-surface diffs probe: keyboard reachable / visible focus / logical tab order / escape-close for overlays. Also probe contrast, text sizing, and error states not color-only. Check that every input has an accessible label. Check that icon-only buttons have an accessible name. Check that modals trap focus and restore it on close. Check that async/loading/error/success states are announced or clearly represented. **Anti-patterns (auto-findings):** `div`/`span` click target instead of button. Placeholder text as the only label. Focus outline removed without replacement. Error indicated only by red color. **For a UI-surface feature this dimension is stage-1 (blocking)** — compliance risk outranks the usual "non-blocking quality" posture. For a non-UI feature, skip this dimension entirely.
- **Observability (runtime).** Lifted from `vibe-observability-incident`. If `sad.md` §7 (deployment context) or §8 (crosscutting) declared metrics / alerts / traces for this feature, verify the diff **emits them at the boundaries**: request/job/webhook start-end, external-API call, queue/background job, auth/payment/data-write failure. Use RED metrics framing — rate / latency / errors / saturation — for what to expect. A declared metric/alert/trace that the code never emits is a finding (the runbook lies). If the design declared no observability for this feature, skip.
- **Boundary violations.** The diff stayed inside the module(s) the tasks named. No weakened test. No forbidden DB construct vs the repo's migration rules.
- **Test adequacy.** Do the tests exercise the real behaviour, including the failure paths? Or only the happy path? Apply the **litmus test** (lifted from `test-master/references/test-quality-review.md`): for each AC-level test, *if you delete the core-logic line under test, does the test still pass?* A yes is a mock-only false-confidence test (finding: high severity).
- **Complexity / over-engineering (the deletion axis).** Lifted from `ponytail-audit`. Scan the diff for over-engineering with 5 tags. `delete:` (dead code, unused flexibility, speculative feature). `stdlib:` (hand-rolled thing the stdlib ships — name the function). `native:` (a dep doing what the platform already does — name the feature). `yagni:` (abstraction with one implementation, config nobody sets, layer with one caller). `shrink:` (same logic, fewer lines — show the shorter form). Emit one line per finding: `<tag> <what to cut>. <replacement>. [path]`. Non-blocking by default. The output closes with `net: -<N> lines possible` across the diff. Correctness, security, and performance are explicitly out of scope for this tag-set. Route those to the dimensions above.

## Dispatch shape

Reuse the clean-context discipline from [`../../_shared/critic.md`](../../_shared/critic.md). The reviewer has read-only tools. It re-reads `spec.md` / contracts / ADRs itself. It emits **cited** findings only:

```
- **[stage-N/severity] <headline>** — file:line; AC: <id|n/a>; problem: <what>; suggested: <fix>.
```

### Severity model (lifted from `review-agent` + `security-auditor`)

Every finding carries one of `critical` / `high` / `medium` / `low`:
- **critical** — immediate exploitation, data loss, RCE, data breach, outage. **Promotes a stage-2 finding to stage-1 (blocking).**
- **high** — auth bypass, injection, missing ownership on a protected record, broken AC.
- **medium** — weak crypto, missing security header, missing observability for a declared alert.
- **low** — info disclosure, style nit that affects maintainability.

### Finding-qualification gate (the noise filter)

A pattern qualifies as a finding **only if all 5 hold** (lifted from `review-agent`):
1. Affects correctness, security, performance, or maintainability.
2. Discrete and actionable (a specific change fixes it).
3. Introduced by this change (not pre-existing).
4. Demonstrable from the code (cite `file:line`).
5. The author would likely fix it.

**Do not flag:** speculative concerns, pre-existing problems, intentional behavior changes documented in an ADR/§1 ¶4 Override, or style nits. Prefer `REVIEW_CLEAN` to a noisy report.

On an async host (background/teammate mode), append the report-delivery instruction ([`../../_shared/agent-roster.md`](../../_shared/agent-roster.md), shared-contract point 2) to the dispatch prompt. An idle signal without the report is not a verdict. Pull the report via messaging before merging findings.

A clean review returns `REVIEW_CLEAN: <scope>`. Drop any finding without a `file:line` + a concrete reason. It is not actionable. Prioritise correctness and AC-compliance over style. Judge against the artifacts, not personal taste (if the spec says hide-existence, a 404-style response is correct, not a bug).
