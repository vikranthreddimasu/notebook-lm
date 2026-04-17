# Design System — Offline Notebook LM

*Lazy Scholar, Refined.* A warm, quiet reading room for researchers who chat with their own documents.

## Product Context

- **What this is:** An offline-first desktop RAG assistant. Upload PDFs, DOCX, Markdown, TXT — embeddings build locally via sentence-transformers + ChromaDB, answers stream from a local LLM (Ollama or llama.cpp) with grounded, clickable citations. Electron + React + Vite frontend, FastAPI backend.
- **Who it's for:** Researchers, grad students, and knowledge workers who care about privacy, owning their data, and grounded citations over hallucinations. Think the overlap of Obsidian power-users and NotebookLM users who don't want to upload their work to Google.
- **Space/industry:** Personal knowledge management, research tools, offline-first AI. Peers in visual language: Granola, Cursor, Linear, Raycast. Peers in workflow: NotebookLM, Obsidian, Mem, Reflect.
- **Project type:** Cross-platform desktop application (Electron). Dense reference work, long reading sessions, precise keyboard-driven interaction.

## Aesthetic Direction

- **Direction:** Lazy Scholar, Refined — warm-dark reading room.
- **Decoration level:** Minimal. Typography does the work. No gradients, no patterns, no decorative glows. The one exception: a subtle amber halo on citation hover.
- **Mood:** A rare-books reading room at 11pm with one lamp on. The tool recedes; the content dominates. Calm, literate, serious about craft. The opposite of a syncy cloud-AI dashboard.
- **Reference mood (not copy):** Granola's single-column warmth, Cursor's dark-theme density, Linear docs' serif-on-sans pairing, Vercel's typographic restraint.

## Typography

The core bet: add a **serif display face** so the product reads as "made for readers." Every other RAG tool uses a grotesque for everything; we don't.

- **Display** (welcome hero, document titles, empty states) — `'Instrument Serif', ui-serif, Georgia, serif` in italic. Self-hosted or via Bunny Fonts. Used at 36, 48, 64, 80px.
- **Body** (chat, paragraphs, reading) — `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif`. 15/16px, line-height 1.55, weight 400.
- **UI / labels / buttons** — `Plus Jakarta Sans`, 13/14px, weight 500–550.
- **Data / counts / timestamps** — `'Geist Mono', 'JetBrains Mono', 'SF Mono', monospace`, tabular-nums, letter-spacing `+0.02em`. Used for chunk counts, token counters, timestamps, relevance scores, citation markers.
- **Code / retrieved passages** — `Geist Mono` 13px.

**Loading:** Bunny Fonts (privacy-friendly, GDPR-safe CDN) or self-host in `/apps/desktop/public/fonts/`. Preconnect + `display=swap`.

**Font features for body:** `font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';` (already in `index.css` — keep).

**Scale:**

| Token | Size | Use |
|-------|------|-----|
| `--text-xs` | 11px | metadata, micro-caps, timestamps |
| `--text-sm` | 13px | UI labels, chips, source card names |
| `--text-base` | 15px | body, chat messages |
| `--text-md` | 16px | welcome subtitle, prominent body |
| `--text-lg` | 18px | section titles in dense UI |
| `--text-xl` | 22px | card titles |
| `--text-2xl` | 28px | (reserved) |
| `--text-display-sm` | 36px | document titles, section headers (serif) |
| `--text-display-md` | 48px | empty states (serif) |
| `--text-display-lg` | 64px | hero (serif) |
| `--text-display-xl` | 80px | welcome marquee (serif) |

## Color

Dual-accent system. **Sage is your action. Amber is the model's grounding.** Slate is uncertainty. Three distinct signals, no overlap.

**Backgrounds (warm stone, not cold gray):**

- `--color-bg-primary` `#0c0a09` — warm ink
- `--color-bg-secondary` `#161412` — sidebar, source panel
- `--color-bg-surface` `#1c1917` — cards
- `--color-bg-elevated` `#262220` — hovered cards, modals
- `--color-bg-hover` `rgba(245, 240, 234, 0.04)`
- `--color-bg-active` `rgba(245, 240, 234, 0.07)`

**Borders:**

- `--color-border` `rgba(245, 240, 234, 0.07)`
- `--color-border-subtle` `rgba(245, 240, 234, 0.04)`
- `--color-border-hover` `rgba(245, 240, 234, 0.14)`

**Text (warm off-whites, never pure white):**

- `--color-text-primary` `#f5f0ea` — aged vellum
- `--color-text-secondary` `#a8a29e`
- `--color-text-muted` `#57534e`

**Primary — your action (sage):**

- `--color-accent` `#7c9a82`
- `--color-accent-hover` `#6a8a70`
- `--color-accent-subtle` `rgba(124, 154, 130, 0.10)`
- `--color-accent-glow` `rgba(124, 154, 130, 0.15)`

**Citation — grounding (warm amber, NEW):**

- `--color-cite` `#d9925a` — used on cited sentence left-rule, citation chip, source count pill, top-relevance bar, streaming cursor
- `--color-cite-hover` `#c67f49`
- `--color-cite-subtle` `rgba(217, 146, 90, 0.10)`
- `--color-cite-glow` `rgba(217, 146, 90, 0.22)`

**Uncertainty — low-confidence (dusty slate, NEW):**

- `--color-uncertain` `#6b7a8f` — used when retrieval top-match scores below threshold, "I'm not sure" answers, weak-match banner
- `--color-uncertain-subtle` `rgba(107, 122, 143, 0.10)`

**Semantic (kept):**

- `--color-success` `#4ade80`
- `--color-error` `#fb7185`
- `--color-warning` `#fbbf24`

**Light mode:** Not the default. If added later, invert backgrounds to `#f5f0ea → #ffffff` gradient, reduce saturation on sage/amber by ~15%, darken text to `#1a1613`. Not a priority for v1.

## Spacing

4px base (keep). Density: comfortable for chat, spacious for welcome/empty states.

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |
| `--space-20` | 80px |
| `--space-24` | 96px |

## Layout

- **Approach:** Hybrid. Grid-disciplined chrome (three-pane Electron shell), editorial typography inside the content column.
- **Three-pane default:** sidebar `240px` | chat (fluid) | source panel `280px`.
- **Max content width for reading:** none in chat pane (fill the column), but body text line-length should wrap around 72ch through a reading-mode class when document preview is open.
- **Titlebar:** `52px`, draggable, sidebar header padding-top aligns to this.

### Radius Hierarchy (the fix)

Previously every surface collapsed to `999px`. That made inputs, cards, and buttons read as the same family. New hierarchy:

| Token | Value | Use |
|-------|-------|-----|
| `--radius-xs` | 6px | context menu items, tiny chips |
| `--radius-input` | 10px | text inputs, search fields |
| `--radius-card` | 14px | source cards, message bubbles |
| `--radius-textarea` | 16px | composer, multi-line inputs |
| `--radius-modal` | 20px | modals, command palette, preview dialogs |
| `--radius-pill` | 999px | buttons, tags, status pills, sidebar items, quick chips |

Rule of thumb: **pill is for action and identity** (buttons, tags, status). **Hierarchical radius is for containers** (inputs, cards, modals).

## Motion

Minimal-functional. Motion tokens already good — keep.

- **Easing:** `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` (enter, hover), `--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)` (move).
- **Duration:** `--duration-fast: 120ms` (hover, focus), `--duration-normal: 200ms` (state change, card lift), `--duration-slow: 350ms` (entrance, relevance bar fill).
- **Signature micro-moment:** citation hover "un-crease" — when a source card is hovered, it lifts 1px with a faint amber halo (`--color-cite-glow`) in 180ms ease-out. This is the only decorative motion; everything else serves comprehension.
- **Reduced motion:** respect `prefers-reduced-motion: reduce` by disabling all transitions except opacity.

## Citation Pattern — the signature treatment

When the LLM returns a cited sentence in chat, render it with:

```html
<span class="cited">
  The sentence text continues through the paragraph.<span class="cite-marker">[1]</span>
</span>
```

```css
.cited {
  display: block;
  padding: 4px 0 4px 16px;
  border-left: 2px solid var(--color-cite);
  margin: var(--space-2) 0;
  transition: background 200ms var(--ease-out);
}
.cited:hover {
  background: var(--color-cite-subtle);
  box-shadow: var(--shadow-cite-glow);
}
.cite-marker {
  color: var(--color-cite);
  font-family: var(--font-mono);
  font-size: 0.7em;
  vertical-align: super;
  margin-left: 4px;
  letter-spacing: 0.04em;
}
```

Clicking a cited sentence opens the source document at the exact paragraph with the passage highlighted (already wired — see research trust layer work).

Non-cited prose uses normal `<p>` styling without the left rule. The visual split between "grounded" and "synthesized" is instant and typographic.

## Shadows

- `--shadow-sm: 0 1px 2px rgba(10, 8, 6, 0.5)`
- `--shadow-md: 0 4px 16px rgba(10, 8, 6, 0.45)`
- `--shadow-lg: 0 12px 40px rgba(10, 8, 6, 0.55)`
- `--shadow-inset: inset 0 1px 0 rgba(245, 240, 234, 0.03)`
- `--shadow-cite-glow: 0 0 24px rgba(217, 146, 90, 0.14)` — citation hover only

## Implementation Notes

- **Existing tokens file:** `apps/desktop/src/design-system/tokens.css` — this is the source of truth in code. Update it to match this document.
- **Serif font loading:** add `<link>` to `apps/desktop/index.html` preconnecting to `fonts.bunny.net` and loading `instrument-serif:400,400i|plus-jakarta-sans:400,450,500,550,600,700|geist-mono:400,500`.
- **Font blacklist for this project:** do not introduce Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Montserrat, or Poppins. These are explicitly not our voice.
- **Do not introduce:** purple/violet gradients, 3-column feature grids with icons in colored circles, centered-everything layouts, uniform pill border-radius everywhere, generic stock-photo hero images.
- **Preview reference:** see `/tmp/notebook-lm-design-preview-*.html` (generated by `/design-consultation`) for the visual reference of this system applied to real screens.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-17 | Established Lazy Scholar, Refined as system of record | Evolved the existing tokens.css direction; kept warm palette + sage; added serif display, amber citation color, uncertainty slate, hierarchical radius. Documented rationale. |
| 2026-04-17 | Added Instrument Serif as display face | Category baseline is all-grotesque. Serif italic at display sizes signals "for readers, not engineers." Biggest differentiator vs NotebookLM / Obsidian / Mem. |
| 2026-04-17 | Added `--color-cite` amber `#d9925a` | Needed a signal distinct from primary sage so users can instantly see which parts of an answer are grounded vs synthesized. Enables typographic citation treatment (left-rule) in place of footnote chips. |
| 2026-04-17 | Added `--color-uncertain` slate `#6b7a8f` | This is a trust product. Doubt deserves its own visual language — when retrieval confidence is low, the UI should say so before the user reads a word. |
| 2026-04-17 | Retired blanket `999px` radius | Inputs, cards, modals, and buttons all sharing pill radius erased hierarchy. Moved to: pill for action (buttons, tags), 10–20px for containers. |
