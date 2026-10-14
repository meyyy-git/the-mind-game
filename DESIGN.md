---
name: The Minds
description: A quiet table at night. Cards carry heat from cool teal (1) to warm ember (100).
colors:
  bg: "#0b0d13"
  bg-2: "#10131b"
  surface: "#151924"
  surface-2: "#1c2130"
  line: "#262c3b"
  line-2: "#363e52"
  text: "#eceff5"
  muted: "#9aa3b6"
  ember: "#f39a5b"
  ember-ink: "#1f1107"
  cool: "#62c7c1"
  danger: "#f07b74"
  card-cool: "#6ccfc7"
  card-warm: "#f38a5a"
  card-ink: "#0f121a"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable (wdth 75-85%), system-ui"
    weight: 700-800
  body:
    fontFamily: "Geist Variable, system-ui"
rounded:
  card: "12px"
  control: "14px"
  panel: "22px"
  chip: "999px"
---

# Design System: The Minds

## Direction

**"A quiet table at night."** The Mind is about a shared sense of timing across the range 1 to 100, so the deck itself is the brand: every card face is tinted by its value, cool teal at 1 through a neutral middle to warm ember at 100 (`color-mix(in oklab, card-cool, card-warm)`). The table glow takes the heat of the top card, so the room visibly warms as play climbs. This is information the table already shows, never a timing hint.

Dark only. The product brief asks for a dark, mysterious table; there is no light theme.

## Color

- **Ember** is the only accent: primary buttons, the viewer's own seat, the playable card ring, level progress, shuriken.
- **Cool** marks positive state (ready, approved, connected). **Danger** marks lives, mistakes, and disconnects.
- Neutrals are cool off-blacks (`bg`, `surface`) with `text`/`muted` for copy. No purple, no gold.

## Typography

Bricolage Grotesque (self-hosted via `@fontsource-variable`) is used condensed (`font-stretch: 75%`) for card numbers, the title, and headings; Geist for UI text. Numbers use tabular figures.

## Shape and depth

Cards 12px, buttons and fields 14px, panels and sheets 22px, status chips are pills. Buttons are tactile: an inset bottom edge that collapses on press. Cards have an inner print frame and a soft drop shadow.

## Layout

- **Home**: title, one-line rule, and the create/join form on the left; a fan of five cards spanning the deck on the right. On phones the fan sits above the title.
- **Room**: a bar (masked code, copy link, connection, players button) above the **stage** and the **dock**.
  - Stage = shared state: HUD (level track, lives, shuriken), seats, center pile with who played it, phase message, missed cards, vote chips, lobby CTA.
  - Dock = the viewer's own things, sticky at the bottom: the hand held as a fan and the next action.
  - Players and settings live in a drawer (bottom sheet on phones).
- Desktop fits the whole room in one screen (checked at 1280x720 up to 1920x1080): the HUD splits around the seats in one row, the dock places the hand in the middle and the actions on the right, and card sizes follow the viewport height (`dvh`). Phones keep the stacked layout with a sticky dock.
- One primary action per phase: copy invite, deal, ready, vote, resume, or back to lobby.

## Hand

Cards fan with a small rotation and arc. From the third card on they overlap only as much as the row needs, keeping corner indices readable; covered cards hide their center number (from 10 cards on desktop, 6 on phones, where the fan also flattens). The lowest card is separated, lifted, and ringed in ember when playable.

## Motion

Each animation states a change: a new hand deals in with a stagger; the played card flies in from the dock (yours) or from above (others) and the player's seat pings; lives and shuriken pop when they change; sheets rise and the drawer slides. The stage glow eases between heats. `prefers-reduced-motion` reduces all of it to instant. Nothing loops, and nothing signals when to play.

## Logo

Two card outlines, tilted like a small fan: the back card in cool teal (hidden), the front card in ember (played), filled with the surface color so it covers the back one. Used in the wordmark, on card backs, the farewell screen, and the favicon (`public/icon.svg`). Component: `Mark` in `src/ui.tsx`; set `--mark-bg` to the surface behind it.

## Icons

Phosphor (`@phosphor-icons/react`), bold weight by default; filled for hearts and shuriken.
