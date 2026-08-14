---
name: glossary
model: inherit
effort: low
agents: []
description: >
  Use to capture or update domain terms in CONTEXT.md before their meaning drifts.
  Apply when a fuzzy word appears in an interview, a spec, or a review. Captures one
  canonical definition plus a NOT-reference, so a homonym cannot mislead you in six
  months. Triggers on "add term {X}", "what is {X} in our domain", "add to CONTEXT",
  "fix the glossary", "define {X}", "glossary {term}", "додай термін", "онови
  глосарій", "що означає {X}". Two levels apply. Repo-root CONTEXT.md holds
  project-wide terms. docs/features/{slug}/CONTEXT.md holds feature-scoped terms.
  Readers read both, and the per-feature entry wins. Lazy-bootstraps the target from
  a template. Checks BOTH levels for a conflicting existing entry. Asks for a
  one-sentence definition + the concept it is confused with. Appends one line to
  ## Glossary. Skip generic tech words (HTTP, queue, cache). Those are not domain
  terms. Output: created/edited CONTEXT.md. Runs anytime, with no input gate.
  specify, clarify, design and api read its ## Glossary as the canonical source of
  role and domain-term names.
---

# Skill: glossary

Lazy utility that fixes the meaning of a domain term in `CONTEXT.md` the moment it first appears, so its sense doesn't drift across the pipeline. For each term it captures a one-sentence canonical definition. When the word is ambiguous, it also captures a **NOT-reference**. The NOT-reference names the concept people confuse with the term. Runs anytime, with no upstream gate: a single term mid-interview, an `undefined-term` finding `clarify` resolves mid-sweep, or a batch handed over by `specify`. The output feeds `specify` (role + domain-term names) and `design` (invariants). Both treat `## Glossary` as canonical and override anything that contradicts it.

This is a capture utility, not a Socratic stage — it does **not** run the shared Socratic loop or critic. The one shared dependency is question phrasing:
→ [`../_shared/ask-style.md`](../_shared/ask-style.md)

Term definitions follow `artifact_language` — the `## Glossary` heading and the other H2s stay English. The frontmatter keeps the **template's** values (`status: Living` + `updated_at:` — never write `artifact_language` or any other settings key into the file) → [`../_shared/artifact-language.md`](../_shared/artifact-language.md).

## Owner

Whoever drives the conversation — anyone who spots ambiguity. Tech Lead approves the canonical form when a term is contested.

## Inputs

- `<term>` — the domain word/phrase to fix. If not given, ask for it.
- (Optional) `<slug>` — feature slug. It targets `docs/features/<slug>/CONTEXT.md`. Absent → repo-root `CONTEXT.md`.
- (Optional) `pending_glossary_terms` — a batch handed over by `specify` after it writes the spec. Process each term in turn.
- (Optional) an `undefined-term` finding from `clarify` — `clarify` invokes this skill **mid-stream**, one term at a time, the moment such a finding is Resolved (it never invents a meaning inline — the canonical definition lands here).
- (Optional) proposed phrasings already offered in an interview/brainstorm — offer them as definition options instead of asking blank.
- (Optional, project-level override) `docs/.skill-context/sdd-glossary/SKILL.md` — if it exists, read it and treat its rules as project-level overrides (conflict → they win and apply to all outputs) → [`../_shared/skill-context.md`](../_shared/skill-context.md). Absent → no-op (defaults apply).

## Protocol

1. **Pick the target (the two-level contract).** Root `CONTEXT.md` = **project-wide** terms (meaningful across features). `docs/features/<slug>/CONTEXT.md` = **feature-scoped** terms (meaningful only inside that feature). If `<slug>` is given → the per-feature file. Otherwise → repo-root. A term lives in exactly **one** of the two files — never split or duplicate it across levels. Readers (`specify`, `clarify`, `design`, `api`) read **both** files. On a conflict the per-feature entry wins.
2. **Generic-term filter.** Reject words that name infrastructure or transport, not the business domain (e.g. HTTP, queue, cache, the datastore, the broker, a framework). Refuse: «`<term>` is technical, not a domain word — its choice belongs in the SAD or an ADR, not the glossary». Continue only for genuine domain vocabulary.
3. **Bootstrap (lazy).** `test -f <target>`. Missing → copy [`./templates/CONTEXT.md`](./templates/CONTEXT.md) to `<target>`. Present → read it.
4. **Conflict check — both levels.** `grep -i "^- <term>" <target>` AND the other level's file when it exists (root `CONTEXT.md` ↔ `docs/features/<slug>/CONTEXT.md`).
   - Found (either level), identical sense → STOP, report «already in the glossary» + which file holds it — never duplicate a term across levels.
   - Found (either level), different sense → escalate via `AskUserQuestion` (phrasing per [`../_shared/ask-style.md`](../_shared/ask-style.md)): «`<term>` is already defined as `<existing>` in `<file>` — same concept or a different one?». If different: a genuinely feature-scoped narrowing goes to the per-feature file (readers let it win there). Otherwise propose a disambiguating pair of names (e.g. a billing-scoped vs a runtime-scoped variant) and fix both.
   - Not found in either → continue.
5. **Ask the canonical definition** — one `AskUserQuestion`: «Define `<term>` in this domain, in one sentence». Offer interview/brainstorm phrasings as options when available. Otherwise free text.
6. **Ask the NOT-reference** — one `AskUserQuestion`: «Which concept does `<term>` get confused with, so a future reader doesn't mix them up?». No plausible homonym → `None`.
7. **Compose one line.** `- <term> — <one-sentence definition>. NOT <confused concept + how it differs>.` — or, when step 6 = None, `- <term> — <definition>.`
8. **Append under `## Glossary`.** Read the file, insert the line in `## Glossary` (alphabetical if the section is already sorted, else at the end). Never rewrite existing entries.
9. **Prune empty H2s.** On a fresh bootstrap, delete `## Invariants` / `## Out of scope` if they hold no real content — only `## Glossary` is mandatory. (A genuine invariant or out-of-scope note goes in its section, never as implementation detail.)
10. **Structural self-check** — per [`../_shared/self-check.md`](../_shared/self-check.md): re-read the target file(s) from disk and check **3 items**: (1) the term appears **exactly once across both levels combined** (grep root `CONTEXT.md` + `docs/features/<slug>/CONTEXT.md` — no duplicate, no split). (2) The entry matches the format `- <term> — <definition>.` (with the optional `NOT …` tail). (3) No empty H2 sections remain. Fix + re-check ≤2 cycles. Report anything unresolved.
11. **Stamp + commit + handoff.** Set `updated_at: <today>` in the frontmatter. Propose `context: + <term>` (or `context: + <term>, <term2>` for a batch). May fold into the caller's intake/spec commit. Then **emit the stage-handoff block** per [`../_shared/handoff.md`](../_shared/handoff.md) (utility variant) — *What I did* (incl. «self-check: 3/3 pass») + *Review* (`CONTEXT.md`) + *Run next*: resume your backbone stage (e.g. `/sdd:design <slug>`). `/clear` optional.

## Definition of Done

- `<target>` exists and contains `<term>` under `## Glossary` in the «one-sentence canonical + optional NOT-reference» format.
- Any conflict with an existing entry is resolved (reported as duplicate, or disambiguated into distinct names).
- Generic tech words are refused, not stored.
- Empty H2 sections are pruned on bootstrap. `## Glossary` remains.
- `updated_at` reflects today. A commit is proposed.

## Anti-patterns

- **Glossary as spec or scratch pad.** Implementation detail («counter stored with a 1-minute TTL») belongs in the SAD/ADR, not here.
- **Empty H2 «for completeness».** A heading with no bullets — prune it.
- **Silent edits.** Adding a term without confirming the definition. The author must control the glossary.
- **Batched «I'll add them later».** Capture each term the moment it surfaces — deferral loses it.
- **Storing generic tech words.** HTTP, queue, the datastore name — refuse them.
- **Rewriting on re-run.** The skill reads and appends. It never overwrites the file.
- **Ambiguous term with no NOT-reference.** A homonym without «NOT …» is a six-month confusion waiting to happen.

## References & template

- [`./templates/CONTEXT.md`](./templates/CONTEXT.md) — output scaffold. Inline comments are the per-section contract (Glossary mandatory, Invariants/Out-of-scope pruned when empty).
- [`../_shared/ask-style.md`](../_shared/ask-style.md) — phrasing for the definition / NOT-reference / conflict questions.

## Example invocation

> **User:** «add term tenant for rate-limiting-per-user»
> **Skill:** `<slug>` given → target `docs/features/rate-limiting-per-user/CONTEXT.md`. Generic filter: `tenant` is domain → continue. File missing → copy template. `grep "^- tenant"` → not found. Definition Q → «a billable customer organisation owning 1+ users». NOT-reference Q → «NOT user — a user is one person inside a tenant». Compose `- tenant — a billable customer organisation owning 1+ users. NOT user (a user is one person inside a tenant).` → append under `## Glossary` → prune empty `## Invariants`/`## Out of scope` → `updated_at: 2026-05-28` → commit `context: + tenant`.
