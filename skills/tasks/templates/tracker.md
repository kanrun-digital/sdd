# Tracker — <slug>

> Status of every task in the epic. `implement` updates `done` as it commits each task, and reads
> this file at start as the resume ledger.
> States: `todo` · `in_progress` · `blocked(<reason-ref>)` · `review` · `done`.
> A blocked status **always** carries its reason in the cell: `blocked(OQ-3)` (spec §8 open
> question) · `blocked(red:T4)` (escalation ladder exhausted) · `blocked(dep:T2)` (blocked
> dependency) · `blocked(missing:docker)` (named external fact/tool). A bare `blocked` is invalid —
> `implement` and `review` treat the reason-ref as the block's identity.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | <title> | migration | <owner / TBD> | S | — | todo |
| T2 | <title> | domain | <owner / TBD> | M | — | todo |
| T3 | <title> | infra | <owner / TBD> | M | T1, T2 | todo |
| T4 | <title> | app | <owner / TBD> | M | T3 | todo |
| T5 | <title> | ports | <owner / TBD> | M | T4 | todo |
| T6 | <title> | tests | <owner / TBD> | S | T5 | todo |

**Total:** <N> tasks, ~<P> person-days.
