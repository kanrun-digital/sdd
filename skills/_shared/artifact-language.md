# Artifact language — the `artifact_language` switch (prose ↔ structure)

> **Reference-only.** Not a skill. Every artifact-writing skill reads this file. It gives the one rule
> for the `artifact_language` key in `.claude/sdd.local.md` (defined in
> [`../implement/references/settings.md`](../implement/references/settings.md), default `en`).
> The rule: **prose switches language, structure stays English.** Conversation language (questions +
> option text) is a separate concern → [`ask-style.md`](./ask-style.md).

## TL;DR (українською)

Один перемикач `artifact_language` (`.claude/sdd.local.md`, дефолт `en`): **проза** документів
пайплайна пишеться обраною мовою, **структура — завжди англійською**: заголовки секцій дослівно з
шаблону, frontmatter (ключі і значення), вердикти (`PASS` / `CHANGES REQUESTED`), стани трекера,
Mermaid-ключові слова, machine-поля `tasks.json` / OpenAPI. Пріоритет: мова вже наявного файлу
перемагає налаштування; новий файл наслідує мову сусідів по фічі; ретро-переклад заборонено.
Код, тести, коміти й гілки — **завжди англійською**, незалежно від перемикача.

---

## The rule

Write the **prose** of every pipeline document in the configured language. Keep the **structure**
English, verbatim from the template. In detail:

- **Prose (switches):** paragraphs, list items, table cells, Mermaid node/edge/participant *labels*,
  ADR context/rationale/consequences, review + fix findings, changelog and PR body text, the prose
  fields of `tasks.json` (`title`, `dod`) and of `openapi.yaml` (`summary`, `description`).
- **Structure (stays English):** section headings (verbatim from the template), frontmatter keys
  **and** values, file names, and every machine token listed below.
- **The setting never leaks into artifacts:** `artifact_language` lives in `.claude/sdd.local.md`
  only. Never write it into a document. Never write any other settings key into a document. An
  artifact's frontmatter keys come **verbatim from its template**. Do not improvise keys in any
  language.

## Never translate

The dashboard's state derivation, the implement engine, or downstream skills parse these tokens. One
translated token silently breaks the pipeline:

- Headings the state derivation reads: `## Shipped` (roadmap), `## Test plan` (spec), `## Glossary`
  (CONTEXT.md). Also every other template heading, as a class.
- Review verdict literals: `PASS`, `CHANGES REQUESTED`, `REVIEW_CLEAN`.
- Tracker states `todo / in_progress / review / done` and task ids `T<n>`.
- Frontmatter keys + values (`status: approved`, `test_cmd`, `reflects_commit`, `target_surfaces`, …)
  and the `.size` / `.route` token files.
- Mermaid keywords (`sequenceDiagram`, `participant`, `alt/else/end`, …) and diagram identifiers that
  name real modules / files / endpoints. Labels translate. Names do not translate.
- `tasks.json` machine fields (`id`, `layer`, `deps`, `acs`, `files_hint`, `slug`) and OpenAPI
  paths / `operationId` / status codes / schema names.
- ADR `Status:` values (`Proposed`, `Accepted`, `Deprecated`, `Superseded`).

Code, tests, test names, commit messages, and branch names are **always English**. They sit outside
this key's scope entirely.

## Precedence (editing vs creating)

1. **An existing file's language wins over the setting.** A skill that edits a document
   (`clarify`, `sequences`, `fix`, …) matches the language already on the page.
2. **A new file matches its feature-folder neighbours.** Do not start a second language mid-feature.
3. Only a genuinely fresh start reads the setting. **Never retro-translate** an existing artifact.

## Agent reports

A skill that dispatches a report-writing subagent carries the language in the **dispatch prompt**.
Example: «Write your report's prose in Ukrainian. Keep identifiers, file paths, and verdict literals
as-is.» The skill's own pass is the backstop. `agents/*.md` stay language-neutral.

## Template comments

`<!-- … -->` comments in `skills/*/templates/*.md` are the generation contract, not content. They are
**never copied into the output in any language**.
