# Finding categories — the five groups `refine` classifies findings into

> **Reference-only.** Not a skill. `refine` step 4 produces findings in exactly five groups; this file is the single source for their definitions, examples, and the prose shape every finding follows. The `+check` validator ([`./check-validator.md`](./check-validator.md)) reads this for its verdict semantics; the report template ([`../templates/refinement-report.md`](../templates/refinement-report.md)) renders the groups in the fixed order below.

The groups are processed in a fixed order so the report is scannable and the `+check` recomputation of dependencies (phase b) has a deterministic post-state:

```
1. missing        → 2. improvements  → 3. removals  → 4. out_of_scope
                                                              │
                            5. dependencies  ←  recomputed AFTER (phase b)
```

`dependencies` is **always** computed last: after the other four groups are finalized (and after `+check` filtering when the flag is set), the DAG is recomputed against the post-refinement task set. It is never sent to the validator.

---

## The four-field prose shape (every finding follows this)

Each finding in `missing`, `improvements`, `removals`, and `out_of_scope` is a single block with four fields, in this order — no labeled `Why:` / `Issue:` / `Fix:` headers (the prose carries the signal):

1. **Behavioral impact** — one or two sentences: what breaks, becomes harder, or wastes effort if the plan stays as-is. The *why this matters*, tied to a concrete behavior (a missing capability, a vague task that will be misimplemented, a duplicate that burns cycles).
2. **Optional note** — a short citation from the codebase (`file:line`), an existing pattern the plan should match, a spec/ADR §ref, or a downstream consequence. Include only when it adds signal beyond the behavioral impact. Omit when the impact is self-evident.
3. **Plan anchor** — `Task #<id>` (the task the finding targets), or «after Task #<id>» for a new task in `missing`.
4. **Suggested edit** — the concrete change: what to add (full proposed task text for `missing`), how to reword (full replacement `dod` for `improvements`), or what to remove (for `removals` / `out_of_scope`).

The `dependencies` group uses the **short legacy form** instead (see its section below) — it is not restated in the four-field shape.

---

## 1. `missing` — a task that should exist but doesn't

A gap in the plan: a piece of work the feature requires but no task covers. The most common source of rework — `tasks` first pass routinely misses these.

**Triggers (any one):**
- An AC in `spec.md` §5 is not covered by any task's `acs` (the J3 contract-presence gate from `tasks` would catch a missing *contract artifact*; this catches a missing *task*).
- `sad.md` §6 names a runtime step (idempotency check, retry, dead-letter, fallback) that no task implements.
- An Accepted ADR mandates a behavior (audit logging, soft delete, encryption at rest) that no task delivers.
- An edge case the tech stack implies (null safety on an optional relation, rate limiting on a public endpoint, CSRF on a state-changing form) that no task addresses.
- A migration / config / index change that an existing task's `files_hint` implies but no task owns.

**NOT `missing` (route elsewhere):**
- A useful-but-unrelated capability → `out_of_scope` (gold-plating check — see group 4).
- A task that already exists in the plan but the refiner missed → `+check` verdict `drop` (the validator catches this).

**Example (four-field shape):**

```
The plan leaves the apply-discount handler without an idempotency-key check — a double-click
submits twice and the discount is applied twice, violating AC-04 («at most once»). sad.md §6
step 2 already specifies the check; the plan just doesn't have a task for it. After Task #3
(the handler). Add task T9: "Reject a second apply-discount for the same order within 5s with
409 Conflict; the idempotency key is `order_id + discount_id`. dod: rejects a duplicate
POST within the window with 409; allows it after the window."
```

---

## 2. `improvements` — an existing task that is vague, wrong, or incomplete

The task exists but its definition is too weak to implement correctly or test cleanly. This is where the J1-J4 self-check gates from `tasks` get a second, deeper pass.

**Triggers (any one):**
- `dod` violates the **J1 testable-verb rule**: contains «works correctly» / «handles properly» / «is robust» / «behaves as expected» instead of `passes` / `rejects` / `returns` / `applies` / `renders` / `redirects` / `records` / `blocks` / `emits` / `fails on <input>`.
- `files_hint` is imprecise: lists «various files», a directory too broad to serialize on, or omits a file the task will clearly touch (an integration point the explorer found).
- `acs` is empty for a non-`wiring`/non-`docs` task (every task should trace to at least one AC, or explicitly carry `acs: []` with a one-line reason).
- **J4 risk-weighting missing**: the task's `files_hint` touches auth/payment/billing/migration/PII but has no `"risk": "high"` field.
- The task describes implementation detail that belongs in `design`/`sad.md`, not in a task `dod` (leakage — the task should describe the *observable behavior*, not the algorithm).
- Two tasks have overlapping `files_hint` + `layer` but aren't marked as a compile-coupled lane (the `tasks` step-5 rule) — this is an `improvements` finding (restructure), not a `removals` finding.

**Example:**

```
Task #4's DoD says «handles duplicate apply-discount requests» — no testable verb, no expected
outcome. An implementer could ship a log-and-pass-through and claim it "handles" the case.
Rewrite Task #4 dod as: "Rejects a second apply-discount for the same order within 5s with
409 Conflict; returns 200 for the first. Unit test: two POSTs in the window → exactly one
discount row."
```

---

## 3. `removals` — a duplicate, already-implemented, or dead-on-arrival task

A task that should not be in the plan. Distinct from `out_of_scope` (group 4): a `removals` task is *dead weight* — it duplicates work or targets code that exists. An `out_of_scope` task is *useful but unrelated*.

**Triggers (any one):**
- Two tasks do the same thing (duplicate `files_hint` + `layer` + overlapping `dod`).
- A task's deliverable already exists in the codebase (the explorer found `src/repos/user.ts:12` exposing the query surface a new task proposes to build).
- A task's precondition can never hold (dead-on-arrival): it depends on a task that was removed, or its `acs` reference an AC that was deferred to §8 and won't be in scope.
- A task that violates a Hard Rule from `spec.md` §6 / `sad.md` §11 (e.g. «edit another module» when the architecture forbids it) — it cannot land as written.

**NOT `removals`:**
- A useful-but-unrelated task → `out_of_scope` (so the user sees the idea before it's dropped).
- A task targeting a `- [x]` completed task → never a removal; completed tasks are immutable (report for awareness only).

**Example:**

```
Task #7 ("Create UserRepository") duplicates src/repos/user.ts:12 which already exposes
findById, findByEmail, and create — the explorer confirmed the full surface T7 proposes.
Keeping T7 leads to a parallel implementation and a later dedup refactor. Task #7. Remove
T7; adjust Task #8 to import from src/repos/user.ts instead of the never-created T7 output.
```

---

## 4. `out_of_scope` — useful in itself, but unrelated to this feature (gold-plating)

A task that is reasonable on its own merits but does not serve the feature this plan is about. Keeping it expands scope without a concrete trigger from the spec, the codebase, or the user's refinement prompt. The skill surfaces it in its own report section so the user sees the idea was noticed and can capture it elsewhere (backlog, issue tracker) — it does **not** persist out-of-scope items anywhere.

**Triggers (any one):**
- The task is not traceable to any `spec.md` §5 AC, `sad.md` §6 runtime step, or Accepted ADR.
- The task's `acs` is empty AND its `files_hint` touches a module unrelated to the feature's domain.
- The user's refinement prompt does not mention the task's concern (the prompt is a concrete scope trigger — a task that directly fulfills it is in-scope even if it falls outside the original plan).

**The drop action is identical to `removals`** — the task is removed from the plan. The difference is **report-only**: an `out_of_scope` task appears in the «💡 Out of scope» section so the user sees a useful idea before it's dropped, rather than being lumped into «🗑️ Removals» as dead weight.

**NOT `out_of_scope`:**
- A `missing` task with a concrete trigger (spec/codebase/ADR/prompt) — that's in-scope, judge it on accuracy.
- A task the user explicitly requested in the refinement prompt — in-scope by definition.

**Example:**

```
Task #11 ("Refactor the logging module to structured JSON") is reasonable on its own but
unrelated to the checkout-discounts feature — no AC, no sad.md §6 step, no ADR triggers it.
Keeping it expands the plan into a logging refactor with no concrete payoff for this feature.
Task #11. Drop from the active plan; capture in the issue tracker if worth revisiting as its
own feature.
```

---

## 5. `dependencies` — wrong order, missing edge, or unnecessary serialization (recomputed LAST)

The DAG (`deps` in `tasks.json`) is wrong in one of three ways. This group is **always** computed after the other four groups are finalized (and after `+check` filtering) — it operates on the post-refinement task set. It uses the **short legacy form**, not the four-field prose shape:

**Triggers (any one):**
- **Wrong order**: Task B depends on Task A's output, but A comes after B in the topological sort (or A is not in B's `deps` at all).
- **Missing edge**: Task C consumes a file/type/service that Task A produces, but `C.deps` does not include `A`. The compile-coupled lane rule (`tasks` step 5) is a special case — a contract change + its first implementer should share the contract file in `files_hint`.
- **Unnecessary serialization (improvement, not its own finding unless critical-path)**: two tasks with disjoint `files_hint` are serial when they could parallelize. Flag as an `improvements` finding («T5 and T6 can parallelize — disjoint files_hint») unless the chain is on the critical path (then it's a standalone dependency finding, because a deep serial chain of S tasks is a hidden multi-sprint blocker — the J2 critical-path-depth warning from `tasks`).

**Short legacy form (every dependency finding):**

```
Task #5 should depend on Task #2. Reason: T5 reads the sessions table that T2's migration
creates; without the edge, implement may schedule T5 before T2 and hit a missing-table error.
```

**Recomputation rules (phase b of `+check`, or the final pass without `+check`):**

- Start from the original plan tasks.
- Add tasks introduced by `missing.keep` and `missing.modify` (confirmed new tasks).
- Remove tasks targeted by `removals.keep`, `removals.modify`, `out_of_scope.keep`, `out_of_scope.modify` (the drop was confirmed).
- Tasks rescued by `removals.drop` or `out_of_scope.drop` (validator overruled the proposal) stay valid dependency targets.
- `improvements` only reword existing tasks; they never add or remove nodes from the graph.
- Any dependency pointing at a task absent from the post-refinement set is discarded (and the depending task is re-anchored or the dependency dropped with a note in the report).
