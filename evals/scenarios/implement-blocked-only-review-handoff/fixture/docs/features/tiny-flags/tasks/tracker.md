# Tracker — tiny-flags

> Status of every task in the epic. `implement` updates `done` as it commits each task, and reads
> this file at start as the resume ledger.
> States: `todo` · `in_progress` · `blocked(<reason-ref>)` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Implement isEnabled lookup for registered flags | domain | dev | S | — | done |
| T2 | Count flag queries for audit | domain | dev | S | — | blocked(OQ-1) |
| T3 | Expose usage counts helper for tests | tests | dev | S | T2 | blocked(dep:T2) |

**Total:** 3 tasks.
