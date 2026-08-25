---
status: approved
feature_size: S
---

# Tiny flags

## 1. Context

The app needs a minimal in-process feature-flag helper so UI code can gate an experimental
banner without a remote flag service.

## 2. Goals

- Code can ask whether a named flag is enabled.

## 3. Non-goals

- Remote flag providers, persistence, per-user targeting.

## 4. User stories

- US-1: As a developer, I check a named flag and get a boolean, so I can gate features safely.

## 5. Acceptance criteria

- AC-01 (happy): given a registered enabled flag, when I query it, the helper reports it enabled.
- AC-02 (unknown): given a flag name that was never registered, when I query it, the helper
  reports it disabled (never throws).
- AC-03 (audit): given any flag query, when it runs, the query is counted so usage can be
  inspected in tests.

## 8. Open questions

- OQ-1: Which analytics sink should flag-usage counts flow to? (owner: product, due: TBD —
  blocks the audit AC.)
