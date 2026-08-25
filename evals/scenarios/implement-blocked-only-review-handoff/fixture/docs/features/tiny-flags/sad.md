---
status: accepted
feature_size: S
target_surfaces: []
---

# SAD — tiny flags

Single in-process module `src/flags.js`. No datastore, no API surface, no UI surface.
Queries are pure lookups; the audit counter (AC-03) is an in-memory count exposed for tests.
