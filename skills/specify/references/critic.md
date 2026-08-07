# specify — delta over the shared critic

Read [`../../_shared/critic.md`](../../_shared/critic.md) for the canonical dispatch and F1–F6 skeleton. specify supplies only the deltas below; the skill fills the placeholders and dispatches one clean-context `Agent`.

## Placeholders

- **`{{ARTIFACT_NAME}}`** = "Product spec (context / goals / user stories / acceptance criteria / NFRs / KPIs)".
- **`{{DRAFT}}`** = the in-memory `spec.md` draft.
- **`{{EDITS_LOG}}`** = the step-7 edits-log.
- **`{{UPSTREAM_FILES}}`** (the critic Reads these itself):
  - `docs/features/<slug>/CONTEXT.md` — canonical glossary (roles, domain terms).
  - any reference module / doc the user named in step 5 (paths only).

## F5 structural floor (this artifact)

- §4 holds ≥1 US per glossary role + per §2 goal.
- §5 holds ≥1 AC of each of the 5 coverage types **after** drops + OQ-migrations.
- §6 NFR rows all carry a numeric target + measurement (no adjectives, no lone TBD).
- §8 Open Questions has a row for every `save_as_oq` with owner + due.
- **§9 Risks** — every row carries headline + mitigation + severity + owner + due; a `critical`/`high` row never has a non-mitigation («monitor», «watch»); 0 rows valid only with an `<!-- N/A -->` reason (and only at easy depth, where the ideation suite was skipped).
- **§10 Assumptions** — every row carries the statement + source (`user`/`research`/`assumption`/`prior-artifact`) + confidence (`high`/`medium`/`low`); at easy depth ≥1 row exists (the chosen-approach assumption).
- **§1 ¶1 persona card** — present for every distinct segment the feature serves; at easy depth the `JTBD` + `Confidence` fields are non-empty (other fields may stay empty).

## F6 specialization — forbidden-token leak (the load-bearing check)

This is specify's primary F6. Scan §5 AC text for the forbidden tokens in [`draft-generation.md`](./draft-generation.md) (HTTP verbs, URL paths, status numerics, `module.error_name` strings, JSON fragments, SQL/driver constructs). **List every hit**, one bullet per AC line:

```
- **[F6] AC-NN contains forbidden tokens** — line: "<verbatim snippet>"; hits: <token1>, <token2>; suggested: rewrite into business form (actor-observable outcome) OR move the HTTP/error/schema detail to `api`.
```

Also flag any concrete technology name (datastore / broker / framework / library) appearing in §1–§3 — those belong to `design`.

## F1 specialization — approach drift

If the edits-log dropped/edited a US or AC tied to the committed approach in §1 ¶3, check that §1 ¶3 still states that approach accurately. A spec whose body no longer matches its own «committed approach» paragraph is drift.

## F7 specialization — causality / evidence (medium + hard depth only; easy skips — over-engineering)

Two related checks over §1 ¶3 and the §1→§2 trace. Cite the §1 line and the §2/§10 line in every finding.

**(a) Causality trace §1 → §2** (lifted from `vibe-toc-constraint-diagnosis`'s 9 CLR tests, applied to goal-tracing). For each §2 Goal, check:

- **Clarity** — the goal names a concrete outcome, not an aspiration («improve onboarding» is out; «cut time-to-first-lesson» is in).
- **Factual existence** — the problem it addresses is stated in §1 ¶1 (not invented in §2).
- **Causality-not-correlation** — the goal claims the feature *causes* the outcome, not merely correlates with it.
- **Sufficiency** — the goal + the feature's approach (§1 ¶3) are sufficient to produce the outcome; flag if a hidden AND is missing.
- **Missing-AND-causes** — if two goals are really one, flag the redundancy.
- **Reversed causality** — the goal isn't actually the *cause* of the §1 problem going away (the problem may solve itself / be solved elsewhere).
- **Predicted side effects** — the goal doesn't silently produce an undesirable effect the spec ignores (→ candidate §9 Risk).
- **Non-tautology** — the goal isn't a restatement of «build the feature».
- **Timing/environment fit** — the goal is achievable in the feature's timeframe + environment (flag if it depends on a precondition outside this feature's scope → §10 Assumption or §8 OQ).

A goal failing any test → one finding: `- **[F7] §2 Goal "<goal>" <failed-test>** — §1 ¶1 line: "<...>"; §2 line: "<...>"; suggested: <rewrite / move to §3 / add §9 risk / add §10 assumption>`.

**(b) Evidence on §1 ¶3 claims.** At medium/hard, every claim in §1 ¶3 carries a `Fact`/`Interpretation`/`Hypothesis` tag (per [`ideation.md`](./ideation.md)). A §1 ¶3 with **zero `[Fact: ...]` tags** is a finding — the recommendation floats free of evidence. A `[Hypothesis]` claim not mirrored in §10 Assumptions is a finding.

## F8 specialization — architecture-map enforcement (only if `docs/architecture-map.md` was read in step 1)

If `architecture-map.md` exists and was read, the spec must be **architecture-aware**, not just architecture-mentioning. The map names capabilities the system has and limits it can't exceed; those are constraints on §1/§2/§3. For each **explicit constraint** in the map of the form «the system can/can't <X>» (ignore broad descriptive prose — only constraint-shaped sentences):

- Check that the constraint is **reflected** somewhere in §2 (as an enabler) or §3 Non-goals (as a ceiling the spec respects). A constraint the spec silently ignores is a finding.
- Flag any §1–§3 claim that **contradicts** a map constraint without a §1 ¶4 Override bullet documenting the deliberate choice.

One finding per un-reflected or contradicted constraint: `- **[F8] map constraint "<X>" not reflected** — map line: "<...>"; spec §<n> has no acknowledgment; suggested: add a §3 Non-goal respecting it, OR add a §1 ¶4 Override bullet with rationale`. Do not flag map prose that isn't constraint-shaped — over-flagging here is worse than under-flagging.

## F9 specialization — persona provenance (lightweight, every depth)

For each persona card in §1 ¶1:

- If `Confidence: high`, the `Validation evidence` field must be non-empty and point at a concrete source (interview quote, `researcher` row URL, analytics, a `PRIOR_ARTIFACT` file). `Confidence: high` + empty evidence → finding.
- A persona field (Core fear / Hidden objection / Trust proof needed) filled with a generic cliché (*quality, professional, modern, seamless* — the anti-cliché list from [`interview-checklist.md`](./interview-checklist.md)) → finding (the anti-cliché pushback was skipped at capture time).

One finding per violation: `- **[F9] persona "<segment>" <violation>** — §1 ¶1 line: "<...>"; suggested: <demote Confidence to medium + add evidence OR drop the cliché field>`.
