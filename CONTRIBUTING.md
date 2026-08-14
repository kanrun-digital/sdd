# Contributing to SDD

## Adding or editing a skill

A skill lives in `skills/<name>/` and is the **source of truth** for its stage.

1. **`SKILL.md` is a short spine.** Write frontmatter (`name` + a third-person
   `description` with 3–5 trigger phrases, EN plus 2–3 UA). Then write a numbered Protocol.
   Keep it lean. Target well under ~140 lines. Heavy detail goes in `references/`.
   Output scaffolds go in `templates/`.
2. **Don't duplicate shared logic.** The 4-state Socratic machine, the clean-context critic,
   the size matrix, and the `AskUserQuestion` style live once in `skills/_shared/`.
   Reference them with a relative link. Keep only a short per-skill **delta**: your
   decision-types, your section list, your F6 specialization.
3. **Stay stack-agnostic.** Use no hard-coded language, tracker, test framework, or load
   tool. Detect what the repo uses. Or name the detected tool as «whatever your repo
   already uses».
4. **Gate your inputs.** If a prerequisite artifact is missing, hard-refuse. Point to the
   skill that produces it.
5. **One level of `references/`.** No nested reference folders.

## Subagents

Engine subagents live in `agents/*.md`. They carry `name` / `description` /
`model: inherit` frontmatter. Their system prompt instructs them to read upstream
artifacts directly.

## Before you open a PR

Run the validator locally. It is the same gate the `validate` GitHub workflow runs. It now
enforces the plugin's **conventions**, not just its structure:

```bash
python3 scripts/validate_plugin.py
```

It checks that the plugin + marketplace manifests agree on name / version / description.
It checks that the version is semver. It checks that every skill and agent carries its
required frontmatter, and that `_shared/` stays reference-only. It **also** checks the
consistency invariants in the checklist below. It greps for references to the excluded
legacy dirs. (The check count is a moving target — CI asserts exit 0, not a fixed number.)

### Pre-PR checklist

- [ ] **`python3 scripts/validate_plugin.py` passes** (exit 0).
- [ ] **Server change? `cd server && bunx tsc --noEmit && bun test tests/` passes**.
      This is the same gate CI's `server-tests` job runs. It is deterministic and needs
      no network. Fixtures live under `server/tests/fixtures/`.
- [ ] **One canonical source / DRY.** Shared logic lives once in `skills/_shared/`. It
      covers the Socratic machine, the critic, the size matrix, the ask-style, the surface
      taxonomy, the handoff block. Link to it with a relative path. Keep only your
      per-skill *delta*. Never copy a `_shared/` table (e.g. the surface taxonomy) into a
      `SKILL.md`.
- [ ] **Stack-agnostic.** Use no hard-coded language, tracker, test framework, or
      build/load tool. Detect what the repo uses. Or name it «whatever your repo already
      uses».
- [ ] **Every skill ends with the handoff block** ([`skills/_shared/handoff.md`](./skills/_shared/handoff.md))
      as its final step.
- [ ] **Invocation form is `/sdd:<name>`** — the namespaced form, never the hyphenated
      form.
- [ ] **Relative links resolve.** A `[text](./path.md)` target is a real file. The one
      exception is a template-runtime path (`../spec.md`, `../sad.md`, `../contracts/…`, …).
      Such a path resolves only inside a generated `docs/features/<slug>/` folder. The
      validator allowlists those.
- [ ] **References in `references/`, templates in `templates/`** — one level deep, no nested folders.

### Behaviour evals (on-demand — NOT in CI)

`evals/` holds end-to-end skill-behaviour scenarios. The scenarios invoke `claude -p`
headlessly and an LLM judge. They cost tokens and are non-deterministic. So they never run
in CI. When you change a skill's *protocol* (gates, routing, artifact shape), run the
closest scenario locally:

```bash
./evals/run.sh design-gate-refusal    # or: specify-happy-path, classify-size
```

See [`evals/README.md`](./evals/README.md) for prerequisites. It also explains how to add
a scenario.

## Releasing

1. Bump the version in **all four** manifests — `.claude-plugin/plugin.json`,
   `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`.
   The validator fails on any mismatch.
2. `python3 scripts/validate_plugin.py` → exit 0. Then push to `main` and tag `vX.Y.Z`.
3. Claude Code and Codex pick the release up straight from git (`/plugin install sdd@sdd` +
   `/reload-plugins`, `codex plugin marketplace upgrade sdd`). The `install.sh` path always
   downloads `main` (or `--ref vX.Y.Z`). Only the Cursor **marketplace** listing goes
   through a review. See below.

### Publishing to the Cursor marketplace

Cursor plugins are distributed as public git repositories. They are **manually
reviewed**. This covers both the first listing and every subsequent update:

1. **Pre-check locally.** Copy the repo to `~/.cursor/plugins/local/sdd`. Restart Cursor,
   or run **Developer: Reload Window**. Type `/` in the chat. Confirm the skills appear.
2. **The repo already satisfies the format.** `.cursor-plugin/plugin.json` is the manifest.
   Only `name` is strictly required. We also ship displayName / version / description /
   author / license. Cursor auto-discovers `skills/` + `agents/` from the repo root. A
   `.cursor-plugin/marketplace.json` is only needed for multi-plugin repos. This repo
   needs none.
3. **Submit** the repo URL at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish)
   and wait for the review. After approval the plugin appears on cursor.com/marketplace and
   in the in-app marketplace panel. Users install it from there, project- or user-scoped.
4. **Updates are re-reviewed** before the marketplace refreshes. The `install.sh` git path
   keeps tracking `main` immediately, review or not.
