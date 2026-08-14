# Diagram presentation — how to confirm a diagram readably (never dump raw Mermaid)

> **Reference-only.** Not a skill. A skill that asks the user to confirm a Mermaid diagram follows
> this file. The users: `design` C4 §3/§5, `sequences` §6 flows. Other skills may adopt it. The
> enforced rule: **never paste raw Mermaid source into the terminal as the thing to confirm.**
> Raw `sequenceDiagram` / `C4Context` source is unreadable in a chat box. The user cannot judge a
> flow from `participant A as …` lines. Confirm the diagram with a **plain-language description**
> of what it shows. The source itself lands in the file (where Obsidian renders it). If a renderer
> is available, the source also lands in an image.

## Why

A dogfood run pasted raw `sequenceDiagram` blocks as the confirmation prompt. The user cannot read arrows-as-text. They approve blind or get frustrated. The fix separates two concerns. The **source** goes where it renders: the `.md` file, or an optional image. The **question** is asked in prose. The user can evaluate prose.

This file composes with [`mermaid-check.md`](./mermaid-check.md) and [`interview-depth.md`](./interview-depth.md). `mermaid-check.md` answers «does it parse?». `interview-depth.md` answers «ask per-diagram, or proceed?». This file answers «how do I present it?».

## Procedure (per diagram)

1. **Write the diagram to its file first.** Examples: the `sad.md` §6 flow, the §3 C4Context block. Obsidian renders the file natively. Write-first lets the user open the rendered view immediately. (This reverses the old «show then write» order. In practice, «show» dumped raw source. Write-first makes the file the render surface.)
2. **Check that it parses** per [`mermaid-check.md`](./mermaid-check.md) (render-parse with `mmdc` if available, else the structural lint). A diagram that does not parse is never confirmed. Fix it first.
3. **Describe it in prose.** The confirmation prompt is a plain-language account of what the diagram shows, not its source. Name the participants in words. Walk the flow in one or two sentences. **Include the key branches.** Example for a sequence flow:
   > «Flow 1 — read preferences: the member asks for their prefs → the handler asks the service → the service reads the store. If there's no saved row, it returns the on-by-default state instead of an error.»
   For a C4 view: «The Context shows the member and the admin talking to the Preferences system, which depends on the existing Identity system for who's-allowed and writes to one datastore.» Cover every actor/participant and every `alt`/`else` branch in words.
4. **Render an image if a renderer is available.** If `mmdc` (mermaid-cli) is on PATH (or `npx -y @mermaid-js/mermaid-cli`), render the block to an image too. Reference its path. Non-Obsidian users can then see the diagram:
   ```bash
   mmdc -i docs/features/<slug>/sad.md -o docs/features/<slug>/_diagrams/<name>.png 2>&1   # one image per diagram, or per file
   ```
   Mention the path in the prose («rendered to `_diagrams/flow-1.png`»). If no renderer is available, the file + the prose description are enough. Say so. Do not block. This is a graceful fallback, like the `mmdc` path in `mermaid-check.md`.

## Depth governs the ask (per [`interview-depth.md`](./interview-depth.md))

- **easy** → write the diagram. Emit a **one-line prose summary** per diagram. Then **proceed**. No per-diagram `AskUserQuestion`. The summaries are batched into the easy-level assumptions ledger. The user can still veto any flow after the fact. The skill does not stop on each one.
- **medium / hard** → give the prose description (step 3) + an `AskUserQuestion` **confirm per diagram**. Use the 4-state actions from [`ask-style.md`](./ask-style.md) (Accept / Fix / Save-as-OQ / Drop). On **Fix**, take the user's note. Regenerate that one diagram (one round, second answer final). Then check the parse again and describe it again.

The question text is always the **prose description + the file/image path**. It is never the raw block. (If the user explicitly asks to see the source, show it. The *default* confirmation channel stays prose.)

## Discipline

- **Never** make the raw Mermaid source the thing the user confirms. That is the anti-pattern this file exists to kill.
- **Write before you ask** — the file is the render surface. A question before the write leaves nothing for the user to open.
- **Describe every branch**, not just the happy path. An `alt`/`else`/dead-letter branch that the prose skips is a branch the user cannot veto.
- **Check before you describe** — never describe a diagram that does not parse. Never render an image of one either. Fix it per `mermaid-check.md` first.
- The prose is for the user. The source is for the file and `data-model`/downstream. Keep the two channels separate.

## Where each skill calls this

- `design` — at the §3 C4Context and §5 C4Container confirms (steps 5–6). Describe the context/containers in prose. Do not paste raw C4 source as the question.
- `sequences` — at the §6 flow confirm (step 6). Write each flow → check → prose-describe → confirm-by-prose (or proceed at easy).

Each keeps only a one-line «present per [`diagram-presentation.md`]» pointer. The procedure lives here.
