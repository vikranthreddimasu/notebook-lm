# Notebook LM

Offline-first desktop RAG assistant. Electron + React + Vite frontend, FastAPI + ChromaDB backend.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

## Design System

Always read DESIGN.md before making any visual or UI decisions. All font choices,
colors, spacing, radius, motion, and aesthetic direction are defined there. The
design system is called "Lazy Scholar, Refined" and uses a dual-accent color
language: sage (your action) + amber (citation / grounding) + slate (uncertainty).

The source-of-truth tokens file in code is
`apps/desktop/src/design-system/tokens.css` — keep it in sync with DESIGN.md.

Do not deviate without explicit user approval. In QA mode, flag any code that
doesn't match DESIGN.md (wrong radius, off-palette colors, ad-hoc typography,
unapproved fonts like Inter/Roboto/Arial).
