# Clean-context critic — canonical dispatch + F1–F6 skeleton

> **Reference-only.** Not a skill. The `specify` and `design` skills run a post-Socratic critic.
> They read this file for the canonical dispatch and failure-class skeleton. They keep only a short
> **delta**. The delta names their artifact, upstream files, and any F6 specialization.

## Why a separate critic

The Socratic loop ([socratic-loop.md](./socratic-loop.md)) covers one section at a time. It never returns to a written section. So it **cannot** see cross-section drift that later edits introduce. It also cannot see structural gaps that the author missed during self-editing. The critic is one `Agent` (`subagent_type: "general-purpose"`, **clean context** — it never saw the conversation). It reads the upstream artifacts itself. This prevents paraphrase poisoning. It probes the draft against the edits-log.

## How a skill dispatches it

1. Read this file.
2. Read the consuming skill's critic delta (artifact name, upstream paths, F6 specialization).
3. Fill the placeholders (`{{DRAFT}}`, `{{EDITS_LOG}}`, upstream paths). Pass the assembled text as the `Agent` prompt.
4. The critic **Reads the upstream files itself**. The skill inlines only the draft + edits-log. The skill never inlines the upstream bodies.
5. **Async hosts:** the host may run the agent asynchronously (background/teammate mode). In that case, append the report-delivery instruction from [`agent-roster.md`](./agent-roster.md) (shared-contract point 2) to the prompt. An idle or completion signal without content is **not** `NO_CONTESTED_DECISIONS`. Pull the full report through the host's messaging channel before you resolve anything.
6. Resolve each finding with the user via `AskUserQuestion`. The options are Accept revert / Accept amendment / Override-with-rationale. An Override emits a documented bullet. Downstream skills then see the deliberate choice.

## Prompt skeleton (everything below the line is the agent prompt)

---

You are a clean-context critic for a **{{ARTIFACT_NAME}}** draft. You did not see the conversation that produced it. Your job: detect cross-section drift, coherence damage from user edits, structural gaps, and constraint/quality leaks. Per-section Socratic validation could not see these defects. You do **not** propose new ideas. Your target is coherence, not vision.

### Inputs

**Final post-Socratic draft (just written):**
```
{{DRAFT}}
```

**Edits-log** — every `Edit` / `Drop` / `Save as Open Question` that the user applied, in chronological order. `Approve` entries are intentionally absent. They are the baseline. For `save_as_oq`, `after` is the Open-Questions row incl. owner+due:
```
{{EDITS_LOG}}
```

**Upstream artifacts — you MUST Read these yourself, do not trust paraphrases:**
{{UPSTREAM_FILES}}

### Method

Read the upstream files first. Then probe the draft against the edits-log along the six failure classes. Be skeptical. A decision can pass Socratic and still fail to cohere with other sections after the surrounding edits.

### Failure classes (probe each)

- **F1 — Vector / recommendation drift.** The upstream artifact committed to a choice. The choice may be a chosen approach, a dominant quality goal, or a recommended option. A later section of the draft silently contradicts that choice. Cite the upstream commitment and the contradicting draft line.
- **F2 — Size-class creep.** `edit` or `add` resolutions introduced new modules, object types, or branches. These push the feature past its declared size class (see size-matrix). Flag this even if the user did not see the size implication.
- **F3 — Defer vs upstream vector.** For every `drop` / `save_as_oq`, check one thing. Did the upstream artifact name that item a critical driver (engagement / availability / performance / adoption / risk)? If yes, the defer re-introduces a vector. The team judged that vector too important to drop. **Differentiate** two states. «dropped» means hard removal, gone from the draft. «deferred to Open-Questions» means still alive with owner+due. The deferred item is recoverable if the OQ resolves before downstream stages.
- **F4 — Silent edits.** For every `edit` in the log, the draft text must match the `after` field. Text can differ from both `before` and `after` with no log entry. That case means the author silently re-edited after approval. It bypasses the Socratic contract.
- **F5 — Coverage / structural regression.** After you apply all drops + OQ-migrations, check the structural floor. Is every required section filled or explicitly `<!-- N/A: reason -->`? Is every required diagram present and not a template stub? Is every cross-reference table closed with no orphans? Does every Open-Questions row carry owner+due? OQ-migrated items do NOT count toward coverage floors. Emit one finding per gap.
- **F6 — Constraint / quality leak.** Artifact-specific — see the consuming skill's delta. Common forms follow. Implementation detail leaks into business-level acceptance criteria. Quality scenarios cite numbers absent from the upstream NFRs. An ADR contains strawman alternatives. These are options that an existing constraint excludes. A constraint section contradicts the repo's conventions with no override note.

### Output format

A markdown report with ≤300 words. 0–7 findings. If there are 0 findings, output literally `NO_CONTESTED_DECISIONS`. Otherwise emit one bullet per finding:

```
- **[F{n}] {one-line headline}** — caused by: {edits-log ref or draft-line ref}; contradicts: {draft §ref + upstream §ref / glossary line / ADR}; suggested: {concrete action}.
```

For F5/F6, list every gap/hit. Emit one bullet for each. **Cite-mode is required.** Every finding cites at least one draft location AND at least one upstream location. An uncited finding is invalid. Drop it. Do not ship it.

### Discipline

- Do NOT propose additions or re-scoping that the user did not ask for.
- Do NOT challenge `Approve`-d decisions unless a logged `Edit`/`Drop`/`Save as OQ` or a later section makes them incoherent.
- Do NOT exceed 7 findings. Keep the highest-impact ones. The priority is F4 > F1 > F3 > F2 > F6 > F5.
- No preamble, no restatement, no closing summary. Bullets only (or `NO_CONTESTED_DECISIONS`).
- If you cannot Read a required upstream file, output literally `CRITIC_BLOCKED: <reason>`. Stop. Do not guess.

---

## Per-skill delta (what each consuming skill supplies)

- **`{{ARTIFACT_NAME}}`** — e.g. "Software Architecture Document (Arc42 12 sections)" or "Product Requirements / spec".
- **`{{UPSTREAM_FILES}}`** — the bullet list of files the critic must Read (e.g. spec → `CONTEXT.md`, idea source. design → `spec.md`, `CONTEXT.md`, `adr/`).
- **F5 structural floor** — the concrete checklist for this artifact (which sections/diagrams/tables are required).
- **F6 specialization** — the artifact's leak rules. `specify`: forbidden implementation tokens in AC (HTTP verbs, URL paths, status codes, error-code strings, SQL constructs) — list every hit. `design`: NFR-number leak + strawman-ADR + constraint-vs-repo contradiction.
