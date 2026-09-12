---
name: The Minds
description: Dark, mysterious cooperative card game with a purple tabletop and gold actions.
colors:
  ink: "#12111b"
  panel: "#211e30"
  line: "#514664"
  text: "#eee9f2"
  muted: "#b9b1c8"
  gold: "#e3c78e"
  gold-dark: "#392919"
  mint: "#a5d5c1"
  card: "#eee5d3"
  rose: "#e5a6b7"
typography:
  display:
    fontFamily: "Grenze, Georgia, serif"
    fontSize: "clamp(62px,7vw,96px)"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: ".035em"
  headline:
    fontFamily: "Grenze, Georgia, serif"
    fontSize: "34px"
    fontWeight: 500
    lineHeight: 1.15
  body:
    fontFamily: "'Segoe UI', system-ui, sans-serif"
  label:
    fontFamily: "'Segoe UI', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: ".06em"
rounded:
  vote: "8px"
  field: "10px"
  action: "12px"
  panel: "16px"
  player: "18px"
spacing:
  hand-gap: "8px"
  action-gap: "12px"
  field-bottom: "20px"
  menu-padding: "24px 28px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.gold-dark}"
    rounded: "{rounded.action}"
    padding: "13px 24px"
  button-secondary:
    backgroundColor: "#292337"
    textColor: "{colors.text}"
    rounded: "{rounded.action}"
    padding: "13px 24px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "10px 0"
  button-icon:
    backgroundColor: "#211c2c"
    textColor: "{colors.text}"
    rounded: "{rounded.action}"
    width: "44px"
    height: "44px"
  input:
    backgroundColor: "#15131f"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "13px 14px"
  table-card:
    backgroundColor: "{colors.card}"
    textColor: "#392c3a"
    rounded: "{rounded.action}"
    padding: "12px"
    width: "125px"
    height: "169px"
  vote:
    textColor: "{colors.muted}"
    rounded: "{rounded.vote}"
    padding: "8px 12px"
---

# Design System: The Minds

## Overview

**Creative North Star: "The midnight tabletop"**

The implemented game uses a dark purple table, warm gold controls, pale numbered cards, and individual player tokens. The centered title menu introduces the same eye emblem and card shapes used in play. This name describes the built direction; it is not a new brand claim.

The interface keeps the current card, the private hand, and the next game action prominent. Copy explains game actions in Indonesian and English without generic slogans. Room administration sits in a native disclosure below the game.

**Key Characteristics:**

- Purple tabletop with gold actions and pale cards.
- Grenze titles and card numbers with system sans-serif controls.
- Visible player identity and status; concealed opponents' hands.
- Short action feedback without timing assistance.

Recorded from `src/styles.css`, `src/main.tsx`, and `src/ui.tsx`, with product constraints from `PRODUCT.md`. Values describe the current implementation. Browser screenshots, computed styles, and visual accessibility checks were unavailable; this document does not certify rendered appearance.

## Colors

Gold is the primary action color; violet-black surfaces establish the game setting. Frontmatter preserves the ten root color variables by their existing names. Component-specific literals remain component details.

- **Primary:** `gold` for main actions, title, invitations, and shuriken; `gold-dark` for text on primary buttons.
- **Status:** `mint` for readiness, online state, approval, and keyboard focus; `rose` for life icons. Status also has text or icons.
- **Neutral:** `ink` is the page ground; `panel` supports native select options; `line` borders controls. `text` and `muted` distinguish primary and supporting copy. `card` is the played-card face.

Player tokens have local seat colors: `#c0acd9`, `#a4d6c3`, `#e4ca91`, and `#e4aebd`. These identify seats, not game rank. The table uses `radial-gradient(ellipse at 50% 20%,#39314f,#242235 76%)`.

## Typography

Grenze is self-hosted at `/fonts/grenze.ttf`, with a variable weight range of 100–900 and `font-display: swap`; its license is `public/fonts/OFL.txt`. The implementation uses weight 500 for display headings and card numbers. Georgia and serif are fallbacks. Controls and supporting text use Segoe UI, system-ui, sans-serif.

The title uses the frontmatter display role; table messages use the headline role. Eyebrow labels use the label role. Supporting text varies from 12–15px by component, and inputs use 16px. There is no imposed mathematical type scale. Played numbers are 74px with a .9 line height; private hand numbers are 42px with a line height of 1.

## Layout

The shell is centered at a maximum 1320px with 40px side padding. The title area caps at 1000px, its menu at 400px, and room content at 1080px. Four player columns cap at 780px above the table; the first and fourth tokens sit 27px lower. The played card occupies the center, followed by phase actions and a private hand that wraps within 870px. Room controls follow in a native `details` element. The roster uses two columns.

At `max-width: 760px`, shell padding becomes 18px, menu width caps at 380px, decorative menu cards disappear, and the roster becomes one column. The four player columns remain, with smaller tokens and wrapped names. The title becomes `clamp(52px,12vw,76px)`, the played card 101×138px, and hand cards 58×84px. The document body has a 320px minimum width. Guide text in the header becomes icon-only with its accessible label retained; dialog actions stack in reverse column order.

## Elevation & Depth

Tonal layering, an outlined oval table, and small object shadows establish depth. The title emblem and decorative cards are static. The table's outline sits inside its broad border; card shadows separate physical game pieces from the surface.

- Primary action: `0 4px 14px #08061155`.
- Table: `0 20px 50px #0004`.
- Played card: `0 9px 18px #09061266`.
- Private card: `0 5px 9px #0005`.

The played card arrives over .18s with `ease-out`. Private-card hover transforms take .14s; button background feedback takes .16s. Reduced-motion preference removes animations and transitions. No looping animation signals when to play.

## Shapes

Controls use 10–12px corners; menus and dialogs use 16px corners. Player tokens are upright 54×60px rounded rectangles with 18px corners. The table has a 180px radius, reduced to 90px on mobile. Eye rings and connection dots are circular; card ornaments combine circles and rotated squares. Dashed token outlines identify empty seats.

## Components

Result notifications use a native dialog with the completed/failed level, actual reward, and remaining inventory. Dismissal is personal and never sets readiness. The result enters once over 240ms; the lives display reacts over 220ms. Reduced motion disables both. Lobby uses “Bagikan kartu”; after dealing, “Aku siap” changes to “Batal siap” until activation.

The table stats include a compact level progress rail. Completed levels use gold, the current level uses mint, and upcoming levels stay muted. Result dialogs distinguish level completion, card mistakes, wins, and losses; card mistakes list the missed cards and the lost life.

### Buttons

Primary and secondary actions have a minimum height of 50px, 13px 24px padding, 12px corners, and 15px semibold labels. Primary hover is `#efdab0`; secondary hover is `#3a2e48`. Pressing either applies `brightness(.9)`. Disabled buttons normally use .48 opacity. A disabled ready button retains full opacity, mint text, and a `#719b89` border. Text actions are transparent, at least 44px high, and turn gold on hover; icon controls are 44px squares.

### Cards and player tokens

The played card is a noninteractive pale face with the number repeated in opposite corners. Its empty state uses a purple back and eye emblem. Private cards are buttons: only the lowest card is available during active play. That card uses `#f3dfb8`, a gold outline, and an 8px lift (14px on hover). Keyboard focus changes its outline to mint. Other hand cards stay fully opaque while disabled. Opponents expose counts and decorative card backs only.

### Inputs

Fields have visible labels, 50px minimum height, 10px corners, and a `#776886` border. Focus changes the border to gold; keyboard focus also receives the shared 2px mint outline with a 4px offset. Nicknames include a visible description. Native selects retain their platform behavior. Errors appear in a separate alert with explanatory copy.

### Navigation

The header combines the home brand link with game rules, a sound toggle, and a language select. It has no active-route decoration. Menu create/join controls use a selected fill of `#49374d` and text `#f4e3bf`; unselected hover uses `#282033`. Preserve the existing pressed-state semantics. Room management uses the native disclosure marker and turns gold on hover.

### Shuriken voting and dialogs

Vote labels wrap, use 8px corners and a `#71617d` border, and show approval with mint text, a `#719b89` border, and a check icon. Approval and decline remain separate actions. Native confirmation dialogs focus the cancel action first and restore previous focus when closed; stale confirmation is disabled when the table changes. Dialogs use a `#241c31` surface and `#090710d9` backdrop.

## Do's and Don'ts

- Do keep the private hand and next available action easy to find.
- Do use text or icons alongside connection, readiness, and vote colors.
- Do retain keyboard focus, native disclosures and dialogs, and reduced-motion handling.
- Do keep Indonesian and English copy specific to the game action.
- Don't expose another player's private card values.
- Don't introduce animation that supplies timing assistance.
- Don't replace game copy with generic promotional slogans.
- Don't claim browser verification from source inspection alone.
