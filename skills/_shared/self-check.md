# Structural self-check — the final-step verification contract every skill runs

> **Reference-only.** Not a skill. Every skill verifies its own output before handoff. This file is
> the one contract for how. A skill either runs a **named structural checklist** or maps a heavy
> verifier onto this contract. The checklist is defined in the skill's own SKILL.md, at the
> penultimate protocol step. The heavy-verifier mapping appears under «Heavy verifiers count» below.
> In both cases, the SKILL.md names the phrase **structural self-check** where the contract is
> satisfied. That name is the greppable evidence. The validator enforces it.

## TL;DR (українською)

Кожен скіл перед хендофом перевіряє власний артефакт **з диска** за іменованим чеклістом.
Знайшов проблему → виправив і перевірив ще раз (максимум 2 цикли). Не зміг виправити →
чесно каже користувачу, ніколи мовчки. Результат — один рядок у хендофі: «self-check: 6/6 pass».
Скіли з важкими верифікаторами (critic, reviewer, drift-check, mermaid-check, GATE) не дублюють
роботу — їхній верифікатор і **є** self-check; вони додають лише структурні пункти, які він не покриває.

---

## The contract (five steps)

1. **Read the artifact again from disk.** Never check the in-memory draft. Downstream stages read
   the file as written. (A skill that writes nothing — e.g. `interview`, `start` — checks its
   emitted output against its DoD instead.)
2. **Run the named checklist.** Each item is **structural and cheap to verify**: a grep, a count, a
   file-exists test, an enum membership. No item is a judgment call. The checklist lives in the
   skill's own SKILL.md (penultimate protocol step). It has a fixed item count. The result is
   therefore reportable as `N/N`.
3. **Fix + re-check, ≤2 cycles.** Fix a failing item. Then run the checklist again. Two fix cycles
   maximum. An item that still fails after that is *unresolved*. It is not retried forever.
4. **Surface the unresolved — never silently.** Report each still-failing item to the user. Include
   the item name and what was tried. Silently committing a failing artifact is the one forbidden
   move. A stated failure is acceptable. A hidden failure is not.
5. **Report in the handoff.** *What I did* carries one line: «self-check: 6/6 pass» (or
   «self-check: 5/6 — <failing item> unresolved, see above»).

## Heavy verifiers count (no double work)

A skill that already runs a heavy verifier counts that verifier **as** its structural self-check.
The heavy verifiers: the clean-context **critic** (`specify`, `design`), the **reviewer** agent
(`review`), the **devil's-advocate** sweep (`clarify`), the bidirectional **drift check** (`api`),
the **mermaid re-validation** + coverage table (`sequences`), the 4-mandatory **self-check**
(`data-model`, `tasks`), and the per-task **GATE** (`implement`, `fix`). The skill does not add a
second checklist on top. It adds **only the structural items the verifier doesn't cover** (e.g.
«frontmatter stamped», «file at the size-correct target»). It still reports per step 5. The SKILL.md
states the mapping in one literal sentence («<verifier> = this skill's structural self-check»).

## Anti-patterns

- **Judgment items in the checklist.** «The spec is clear» is not checkable. «Every §5 AC id
  appears in the coverage table» is checkable. Judgment belongs to the heavy verifiers.
- **Checking the draft, not the disk.** This contract exists to catch one bug. The write did not
  land the way the conversation assumed.
- **Endless fix loops.** Two cycles, then surface. A checklist that cannot converge in two fixes
  flags a real problem. The user must see it.
- **A silent pass.** The handoff line is mandatory even when everything passes. «self-check: 6/6
  pass» is one line of proof, not noise.
- **Duplicating the heavy verifier.** If the critic already checked cross-section drift, the
  checklist does not re-check it. It checks only the structural leftovers.
