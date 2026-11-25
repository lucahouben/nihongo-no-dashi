# Nihongo no Dashi — Agent Task Backlog

## Locked Architectural & Design Decisions
- **Database Schema:** Keep `vocab` and `sentences` as separate database tables linked via `deck_id`. Do not merge them.
- **Field Naming:** Rename the `Kanji` input field to `Expression` across add/edit forms.
- **Flashcard Layout:** Keep internal vertical scrolling (`overflow-y-auto`) on the answer side of flashcards, with action buttons pinned outside the scroll container.
- **Theme & Favicon:** Do **not** overhaul the current site-wide color palette yet. Update the **favicon / web icon** SVG/assets so their colors match the current web theme instead of standalone Tokyo Night colors.

---

## Phase 1: UI Foundation, Modals & Global Cleanup
*Run sequentially first so all subsequent tasks inherit the unified modal component and clean typography.*

### Task 1.1 — Align Favicon Colors & Level Progression Gradient
- **Files:** `public/favicon.*`, web manifest icons, and level badge/progress components.
- **Requirements:**
  - Update the favicon/web icon colors to match the current webpage theme palette.
  - Update the level color scale so progression starts at red for level 1 and transitions smoothly toward gold at higher mastery levels.

### Task 1.2 — Global Capitalization & Button Prefix Removal
- **Files:** Navigation, homepage, deck lists, modals, and review views.
- **Requirements:**
  - Enforce consistent Title Case capitalization across all page titles, section headers, tool names, and deck names.
  - Remove all leading `>` characters from buttons globally (specifically `Start Session`, `Autofill`, `Clear`, and `Add Word` / `Add Item`).

### Task 1.3 — Unified Modal System (Rename Deck, Delete Deck, Add Item)
- **Files:** Shared Modal component, Deck management actions, Add Item form.
- **Requirements:**
  - Standardize on one centered modal component with a lighter semi-transparent backdrop (lower opacity than the current New Deck modal so background context remains subtly visible).
  - Replace native browser popups (`window.prompt` / `window.confirm`) for **Rename Deck** and **Delete Deck** with this unified modal.
  - Convert the **Add Item** bottom drawer into the same centered modal style.
  - Compact the form inputs inside **Add Item** (reduce vertical height, padding, and spacing so fields are not oversized).
  - Rename the `Kanji` field label to `Expression`.

---

## Phase 2: Scalable Tool-Launcher Homepage
*Restructures the root dashboard to support future tools cleanly.*

### Task 2.1 — Build Modular Tool-Selector Home Screen
- **Files:** Root dashboard route (`/`) and navigation components.
- **Requirements:**
  - Create a home screen grid where users select which tool to launch, driven by a config/array of tool definitions so new tools can be added easily later.
  - **Active Tools:**
    1. **Reviews** (navigates to deck selection / review sessions).
    2. **GBA Emulator** (temporary placeholder name replacing *Emulingo*—use a clean label like `GBA Immersion` or `Game Reader` for now).
  - **Planned / Coming Soon Placeholders (disabled or subtly badged):**
    - `Database Viewer & Editor`
    - `Conversation` (Listening & Speaking Reviews)
    - `Notes` (Browser for notes taken during review sessions)

---

## Phase 3: Review Engine Overhaul (Vocab & Sentences)
*Shared UX/shortcut improvements across both review types, plus sentence-specific IME fixes.*

### Task 3.1 — Review Card Visual & Button Cleanup (Vocab & Sentences)
- **Files:** Vocab review card component, Sentence review card component.
- **Requirements:**
  - Soften/lighten the flashcard background color so it feels less visually heavy.
  - Remove the **Audio Mode** toggle button from the top bar.
  - Remove the **Replay Audio** button from the answer side of the card.
  - Remove the bottom instruction bar's **Play Audio** text and remove the `DETAILS (F)` badge from the bottom of the answer card.
  - Keep the answer side vertically scrollable (`overflow-y-auto`) when content is long, while keeping primary action buttons pinned outside the scrollable area.

### Task 3.2 — Keyboard Shortcuts & Auto-Scroll Overhaul (Vocab & Sentences)
- **Files:** Review keyboard shortcut handler and Shortcuts Legend UI.
- **Requirements:**
  - **`V` — Play Audio:** Rename label in shortcuts legend from `Audio` to `Play Audio`. Ensure pressing `V` works on the Japanese answer side during `EN -> JA` reviews to play pronunciation audio.
  - **`F` — Answer Details:** Rename label in shortcuts legend to `Answer Details`. Pressing `F` must open/expand the details section **and** automatically smooth-scroll the answer card container down to the details section (`scrollIntoView({ behavior: 'smooth', block: 'nearest' })`).
  - **`Esc` — Abandon:** Rename label in shortcuts legend to `Abandon`.
  - **`W` — Wrap Up:** Add `W` shortcut to trigger Wrap Up mode and display `W — Wrap Up` in the shortcuts legend.

### Task 3.3 — Sentence Review IME Input & Confirm Controls
- **Files:** Sentence review component and sentence review shortcut handler.
- **Requirements:**
  - Unbind `Enter` from submitting/confirming the flashcard so pressing `Enter` to accept Japanese IME kanji conversions never accidentally submits the answer.
  - Bind `Space` (when outside active text composition / or as the dedicated confirm key) to confirm/submit the sentence, and display `Space — Confirm` in the shortcuts legend.
  - Rename the flashcard's `Check` button to `Confirm`.
  - *(Out of scope for now)* Do not add automated sentence-checking logic or Japanese keyboard prompt text in this task.

---

## Deferred (Do Not Implement Yet)
- **Emulingo / GBA Emulator:** Full rework and final naming (queued after Phases 1–3).
- **Color Palette Overhaul:** Revisit after all functional changes above are verified.
