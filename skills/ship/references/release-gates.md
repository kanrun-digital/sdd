# Release gates — ship step 1 (conditional, for risky changes)

`ship`'s posture is "PR-readiness, not deploy" — it opens a PR, and the merge is the team's call. Some changes carry enough release risk that *proposing* the PR without a documented rollout plan is itself negligent. This file defines those gates.

## When the gates run

The release-gates checklist fires iff the feature matches **any** of these risk signals (lifted from `vibe-ci-cd-pipeline` + `pre-deploy-qa`):

- **a migration** — a numbered file landed in the repo's migrations dir during `implement` promotion.
- **a public-API change** — `contracts/openapi.yaml` shows a breaking change (a removed/renamed operation, a required field added, a status removed), OR an `events.md` additive-but-breaking case.
- **a `design` §11 High-severity risk row** — `sad.md` §11 carries a row with severity `high` or `critical`.
- **a feature flag was declared** in `sad.md` §7 or the changelog template.

If none hold, skip this file entirely. The standard PR-readiness flow in `SKILL.md` is enough. State the skip in the handoff: *«release-gates: N/A (no migration, no breaking API change, no High §11 risk)»*.

## The gates (one multi-select AskUserQuestion, each either confirmed or explicitly N/A'd)

When the gates fire, walk these four in **one** `AskUserQuestion` batch (phrased per [`../../_shared/ask-style.md`](../../_shared/ask-style.md)). Each gate must be either **confirmed** (with the plan named) or **explicitly N/A'd with a reason**. A blank is not acceptable.

1. **Feature-flag plan.** Is the change behind a flag (or a config gate) so it can be dark-launched and turned off without a redeploy? If yes, name the flag + its default state + who can flip it. If the change is low-risk enough to ship unflagged, say so with a reason.
   - *Source pattern:* `vibe-ci-cd-pipeline` "rollback instructions exist for production-impacting changes" + the changelog's existing `Feature flag / config:` field, promoted from fill-in to gate.

2. **Rollback procedure.** What's the undo path if this goes wrong in prod? For a migration, check that the down-migration is reversible (or the expand/contract state allows a roll-forward). For a code change, check that a revert is clean (no data side-effects) OR a compensating action is documented. Name the concrete step, not "revert the PR".
   - *Source pattern:* `vibe-ci-cd-pipeline` "Rollback instructions exist for production-impacting changes" anti-pattern: "No smoke check after deploy".

3. **Observability checklist.** For the first 24h after deploy, what signal tells you it's healthy vs broken? Name ≥1 metric (from `sad.md` §8 / `spec.md` §7 KPI) + the alert that fires if it degrades + who sees it. A change with no observability signal is a change you'll find out about from a customer.
   - *Source pattern:* `vibe-observability-incident`'s 4-question frame (what failed / who affected / how detect / how recover).

4. **Smoke-test-in-prod plan.** What's the smallest check, run against prod after merge, that confirms the feature actually works in the live environment? For a UI change, use a manual click-through. For an API, use a curl that exercises one happy + one error path. For a background job, use one processed item observed. Lifted from `pre-deploy-qa`'s `deferredToPostDeploy` contract — each deferred criterion carries a concrete verification step.
   - *Source pattern:* `pre-deploy-qa` JSON schema + `deferredToPostDeploy[]` (criterion + reason + verificationSteps).

## Output

The gate result feeds the `ship-gate-result` JSON block (G4) and the changelog's existing `Feature flag` / `Rollback` / `Operational note` fields. They become populated rather than fill-ins. Any gate that cannot be confirmed or N/A'd is a `blocker` in the JSON. The PR command is **not proposed** until every blocker is resolved or explicitly accepted by the user (the accept-the-risk path).
