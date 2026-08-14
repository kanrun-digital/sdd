# Ask-style — junior-friendly `AskUserQuestion`

> **Reference-only.** Not a skill. Every skill that calls `AskUserQuestion` reads this for the
> canonical shape of questions and options. The rule: an **option label is the next mechanical
> step the skill takes**, not just a name. The **description explains, in plain words, what will
> happen**. Write it so a first-year junior can pick correctly without a senior beside them.

> **This file is agent-facing; the questions it produces are not.** Everything here is instruction
> *to the skill*. The language the skill *speaks* is the `conversation_language` setting
> (§ Language). The TL;DR below and the Ukrainian passages further down are **human-facing text and
> sample output** for `conversation_language: uk`, never rules — don't mirror their language into
> your reasoning, your file writes, or your commits.

> **Volume vs. style.** The **number** of questions a Q&A skill asks scales with the
> interview-depth dial (easy asks few, hard asks all — see
> [`interview-depth.md`](./interview-depth.md)). The **per-question explanatory rule below is
> unchanged at every depth**. Even a single easy-level question is glossed and explained in full.
> Depth tunes the count. It never licenses a dry question.

## TL;DR (українською)

Головне правило: **ніколи не питати сухо**. Кожен технічний термін глосується прямо в питанні
(просте пояснення в дужках при першому вживанні), а слова витрачаються на «чому» і trade-off, не
на переказ конфігурації. `label` опції = **наступний механічний крок** скіла (1–5 слів);
`description` = 3–5 речень із чотирма обов'язковими елементами: що технічно станеться → що
виграєш / що втратиш (з глосами) → наступний крок скіла → прихований підступ. Кількість питань
регулює depth-діал; стиль — ні: навіть єдине easy-питання пояснюється повністю.

---

## The one rule that matters most

**Never ask dryly.** The most common failure is a terse, jargon-dense question. It has a few words
plus acronyms, with no context. It forces the user to already know the project to answer. Fix it
two ways, every time:

1. **Gloss every technical term inline, on first use** — the plain meaning in parentheses, right
   there. Not «order by RICE» but «order by RICE — a quick score, Reach × Impact × Confidence ÷
   Effort, where higher = more value per unit of work». Not «forces a worktree» but «forces a
   worktree — a separate working copy of the repo so two agents don't edit the same files». The
   reader should never have to look a term up to choose.
2. **Spend the words on the WHY and the trade-off**, not the WHAT. A short label is fine. The
   *description* is where you explain, in plain language, what happens, what you gain and lose,
   and the hidden catch.

A question that reads like a config dump or a spec excerpt is wrong. Write it as an explanation to
a capable colleague who just joined and doesn't know your acronyms yet. **More explanation always
beats less here** — a long, clear description is a feature, not bloat.

## Shape

- **`question`** — 3–4 sentences in three blocks:
  - **CONTEXT** — why this decision, what scenario to picture, and what exactly we decide (one
    sentence with a concrete example).
  - **WHY IT MATTERS** — which quality goal / NFR / spec vector it touches. Reversibility
    (irreversible? multi-module? affects performance / security / UX?). The main trade-off in play.
  - **READ OPTIONS** — a nudge to read the descriptions before choosing.
- **Each option**:
  - `label` — 1–5 words, **action form** = the next mechanical step: «Прийняти», «Виправити»,
    «Винести у відкрите питання», «Викинути», «Зафіксувати як ADR». Add «(Recommended)» to the
    first option when you recommend it.
  - `description` — 3–5 sentences with four mandatory elements (below).

## The four mandatory elements of a `description`

1. **What technically happens** — concrete names: tables / endpoints / files / ADR numbers. Not
   «modify the API» but «add field `is_active BOOLEAN` to table `members` and a new route in the
   module's handler».
2. **What you gain / what you lose** — the trade-off in plain words, **every technical term
   glossed**:
   - not «backfill migration» → «a script that walks every existing row and fills the new field;
     while it runs the rows are read-locked for writes»
   - not «cursor pagination» → «the client sends the last id it saw so the next page starts after
     it; avoids `OFFSET`, which slows down on large pages»
   - not «GIN index» → «a special index type that lets you search inside JSON columns, but takes
     3–5× more space and writes slower»
3. **The skill's next mechanical step** — «I spawn ADR-NNNN titled X, add a row to the §9 ADR
   table, the schema is locked for the data-model stage».
4. **Hidden trade-off** — a condition may exist under which the choice breaks («only works if
   Redis is already in your stack», «in 6 months you'll need downtime for a backfill», «existing
   users have to re-login»). State it **right in the description**, not in a follow-up. A junior
   won't see that trigger on their own.

## Language

The language of the **conversation** is the `conversation_language` key in `.claude/sdd.local.md`
(`uk | en`, any language tag; **default `uk`** — documented in
[`../implement/references/settings.md`](../implement/references/settings.md)). Resolve it once at
the top of the run, the same way you resolve the depth dial. Write **every** `question`, `label`
and `description` in it.

- **Two independent switches, never conflated.** `conversation_language` = what the skill *says to
  you*. `artifact_language` = what the skill *writes into documents*
  ([`artifact-language.md`](./artifact-language.md)). An interview in Ukrainian with the spec
  written in English is a legitimate, supported combination — do not let one leak into the other.
- **Never switches with the setting** — in any language: technical identifiers (ADR, JSONB, JWT,
  UUID, FK, OpenAPI), file paths, `/sdd:…` commands, and every machine token on the never-translate
  list. They are *names*. So are glossary roles and domain-invariant phrases (e.g. «no published
  lessons») — business terms, quoted as authored.
- **The action semantics never change** — only their surface wording. Approve / Edit / Save as open
  question / Drop mean exactly the same four transitions in every language
  ([`socratic-loop.md`](./socratic-loop.md)).
- **The explanatory rule above is language-independent.** Switching to `en` is not a licence to
  produce the terse labels this file exists to forbid. An English question is held to the same
  gloss-every-term, name-the-trade-off standard as a Ukrainian one.

## Forbidden

- **Terse one-word labels that name a state instead of an action** — a bare `Approve` / `Edit` /
  `Drop` / `Reword` with nothing about what the skill will actually do next. (The failure is
  terseness, not the language: `Approve as written` and «Прийняти як є» are both fine.)
- One-line descriptions.
- Technical terms without a gloss (UNION, backfill, GIN, cursor, idempotent, transactional…).
- Trade-offs hidden in a follow-up («if you pick this I'll later ask about X, which has complexity
  Y»).
- **Mixing languages inside one question set** — pick the resolved `conversation_language` and stay
  in it for every option of that question.

## Counter-example (deprecated) vs correct

The failure below is **terseness**, not English — the DON'T stays wrong when translated.

```
# DON'T — opaque next step, no gloss
- label: "Approve"
  description: "Apply decision."

# DO (conversation_language: en) — action-form label, concrete step + glossed trade-off
- label: "Store the blocks in one JSONB column (→ spawn ADR-0002)"
  description: "A single `body` column of type jsonb holds the whole block array as JSON. PROS: editing a lesson is one UPDATE; a new block type needs no schema migration. CONS: block validation moves to the app layer (the DB doesn't know the types); searching inside `body` needs a GIN index — a special Postgres index for searching within JSON, costing 3–5× the space and slower writes. NEXT STEP: I spawn ADR-0002 with the 3 options considered, add a row to §9, and the schema is locked for the data-model stage. HIDDEN: only pays off if block types really do keep changing — for a fixed set of three, plain columns stay simpler."

# DO (conversation_language: uk) — the same option, same structure, Ukrainian surface
- label: "Прийняти JSONB-колонку (→ spawn ADR-0002)"
  description: "Одна колонка `body` типу jsonb зберігає весь масив блоків як JSON. ПЛЮСИ: редагування уроку одним UPDATE; новий тип блоку не потребує schema-migration. МІНУСИ: валідація блоків лягає на app-layer (БД не знає типів); пошук всередині body потребує GIN-індексу (спеціальний індекс Postgres для пошуку в JSON — у 3–5× більше місця, повільніший запис). НАСЛІДОК: спавню ADR-0002 з 3 розглянутими варіантами, додаю рядок у §9, схема фіксується для stage data-model."
```

## The 4-state actions, phrased this way (canonical set)

Same four transitions in both renderings — the semantics are fixed, only the surface wording moves
with `conversation_language`. Use the block matching the resolved language; for any other language
tag, translate the `en` set and keep the identifiers as-is.

```
# conversation_language: en
- label: "Approve as written"
  description: "I keep the decision verbatim and run the next check (the section's gate, if it has one)."
- label: "Let me reword it"
  description: "You give me new wording or a new value; I regenerate the decision under that constraint and ask once more (single round — your second answer is final)."
- label: "Park it as an open question"
  description: "I take the decision out of the section and add a row to the Open-Questions table with an owner + due date (I ask for both next). Without both it becomes a Drop."
- label: "Drop it"
  description: "I remove the decision. If it's mandatory I reframe the options and ask again; if it's optional I leave it out with no replacement."

# conversation_language: uk
- label: "Прийняти як є"
  description: "Лишаю рішення дослівно, запускаю наступну перевірку (gate, якщо є для цієї секції)."
- label: "Виправити"
  description: "Ти даєш нове формулювання/значення; я регенерую рішення під нову умову і питаю ще раз (один раунд — друга відповідь фінальна)."
- label: "Винести у відкрите питання"
  description: "Прибираю рішення з секції і додаю рядок у таблицю Open-Questions з owner+due (питаю наступним кроком). Без обох — рішення стає Drop."
- label: "Викинути"
  description: "Прибираю рішення. Якщо воно обов'язкове — переформулюю опції і питаю ще раз; якщо опціональне — лишаю без заміни."
```

## Dry → explanatory (worked rewrite)

Rendered here in English (`conversation_language: en`); the *structure* — context, why it matters,
glossed terms, the cost of each option — is what carries over to any language.

```
# TOO DRY (jargon-dense, no context — the failure to avoid):
Question: "Prioritize Next by RICE or manual?"
Options:
  - label: "RICE"
    description: "RICE score, ordered desc."
  - label: "Manual"
    description: "Manual order."

# EXPLANATORY (context + why + glossed terms — do this):
Question:
  "How should we decide the ORDER of the not-yet-started ideas in the roadmap's «Next» list?
   This only affects which problem we pick up next — nothing is committed yet, and you can always
   reorder. The trade-off: a scoring formula is more objective but takes a minute per idea; eyeballing
   it is faster but drifts with mood. Read both options below."
Options:
  - label: "Score each idea (Recommended)"
    description: "I rate every Next idea with RICE — a quick score = Reach (how many users it touches) ×
      Impact (how much it moves the needle, 3 down to 0.25) × Confidence (how sure we are, as a %) ÷
      Effort (rough person-weeks). It gives one sortable number per idea, so «Next» orders itself by
      value-per-effort. You can still override any ranking by hand. Costs ~a minute of estimating per idea."
  - label: "Just order them by hand"
    description: "No formula — you (or I) drag the ideas into the order that feels right; row position =
      priority. Faster and fine for a short list, but with many ideas it gets subjective and the order
      tends to drift over time. You can switch to scoring later if the list grows."
```

The dry version is unanswerable without knowledge of RICE. The explanatory version teaches the term
in the act of asking. It makes the trade-off obvious.

## Why (feedback, 2026-05-23 + reinforced 2026-05-29)

*Source feedback, quoted verbatim in the language it was given — evidence, not an instruction to
answer in that language.* The user is a PM, methodist, or junior dev who opens the repo for the first time. Terse English
questions give them neither the substance of the decision nor the difference between options.
Verbatim (2026-05-23): «Треба щоб пояснення були ще більш зрозумілими для людей котрі буквально
джуни в розробці». Reinforced (2026-05-29): «при опитуваннях треба більш explanatory запитання і
варіанти відповідей, бо зараз клод доволі сухо опитує і багато термінів на короткий текст». That
is, the dryness + term-density was still happening. This file therefore now leads with the «never
ask dryly / gloss every term» rule above.
