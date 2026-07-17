# Nuclear Mission Control — Visual Redesign Spec

**Date:** 2026-07-17
**Scope:** Full visual redesign of all UI pages
**Approach:** CSS/Tailwind v4 aesthetic + Framer Motion for animation orchestration

---

## 1. Overview

Redesign Brocode's visual layer from a minimal utilitarian card UI to a Cold War–era nuclear mission control terminal. The app's existing vocabulary ("armed," "detonated," "ritual," 6-digit codes, 24-hour lockout) maps directly to a two-person launch protocol aesthetic. The redesign surfaces that drama visually.

No changes to business logic, API routes, database schema, or email content. Pure UI layer.

---

## 2. Design System

### 2.1 Color Palette

All defined as CSS custom properties in `app/globals.css` via a `@theme` block.

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#080c08` | Page background (near-black, faint green tint) |
| `--color-phosphor` | `#00ff41` | Primary text, active elements, borders |
| `--color-phosphor-dim` | `#00aa2a` | Secondary text, labels, inactive panels |
| `--color-phosphor-faint` | `#1a3a1a` | Panel backgrounds, subtle fills |
| `--color-amber` | `#ffb000` | Warnings, partial/pending states |
| `--color-alert` | `#ff2222` | Detonated state, destructive actions |
| `--color-panel-border` | `#0d2a0d` | Structural grid lines between panels |

Dark mode uses the same tokens (the design is inherently dark-first).

### 2.2 Typography

- **Font:** Geist Mono exclusively (already in stack via `next/font/google`). Remove Geist Sans — delete the `geistSans` import and variable from `app/layout.tsx` and remove the `${geistSans.variable}` class from `<body>`.
- **Labels:** uppercase, `tracking-widest`, `--color-phosphor-dim`
- **Body text:** `--color-phosphor`
- **Status readouts:** large, bold, `text-shadow: 0 0 10px currentColor`
- **6-digit codes:** `text-6xl`, heavy glow, each digit in its own `<span>` for individual animation

### 2.3 CRT Atmosphere (pure CSS, no JS)

Applied as a fixed full-viewport pseudo-element overlay on `<body>` or a root wrapper:

```css
/* Scanlines */
background: repeating-linear-gradient(
  0deg,
  transparent,
  transparent 2px,
  rgba(0, 0, 0, 0.15) 2px,
  rgba(0, 0, 0, 0.15) 4px
);

/* Vignette */
background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.6) 100%);
```

Both layers are `pointer-events: none; position: fixed; inset: 0; z-index: 9999`.

Glowing elements use layered `text-shadow` / `box-shadow`:
```css
text-shadow: 0 0 4px currentColor, 0 0 12px currentColor;
box-shadow: 0 0 4px currentColor, 0 0 16px currentColor, inset 0 0 4px currentColor;
```

---

## 3. New Dependency

**Framer Motion** — for cinematic animation sequencing. Install: `pnpm add framer-motion`.

Required because the detonation sequence, staggered panel reveals, and page transitions need coordinated multi-step timing that pure CSS `@keyframes` cannot cleanly express alongside React state changes.

---

## 4. Layout Changes

All pages move from centered single-column cards (`max-w-lg mx-auto`) to full-viewport multi-panel instrument boards.

### Shared Structure

Every page uses a common shell:
- **Full-viewport dark background** with CRT overlay
- **Header bar** (full width, `border-b --color-panel-border`): app name left, live status indicator right
- **Panel grid** below the header: page-specific layout
- All panels have `border --color-panel-border`, `bg-[--color-phosphor-faint]`, and a labeled header strip (`uppercase tracking-widest text-xs --color-phosphor-dim`)

---

## 5. Page Designs

### 5.1 Create Page (`/`) — "PRE-LAUNCH CONFIGURATION"

**Header bar:** `BROCODE LAUNCH SYSTEM v1.0` | `● SYSTEM READY` (blinking green dot)

**Panel layout (2-column below header):**
- **Left — MISSION PARAMETERS:**
  - Creator name field: labeled `OPERATIVE CALLSIGN`
  - Title field: labeled `MISSION DESIGNATION`
  - Contacts list: each contact is a numbered row `[01] OPERATIVE NAME / EMAIL` with a `[REMOVE]` button
  - Add contact button: `[+ ADD OPERATIVE]`
- **Right — PAYLOAD:**
  - File drop zone: dashed phosphor border, `DROP PAYLOAD OR CLICK TO UPLOAD` in dim text, file type/size constraints shown below

**Bottom (full width):** `▶ ARM BROCODE` — large launch-style button, phosphor border at rest, red glow on hover, requires click-hold (500ms) before firing to prevent misfire. Shows a fill animation during hold.

**Post-submit state:** Two panels collapse (Framer Motion exit), replaced by a single full-width "ARMED" readout:
- `SYSTEM STATUS: ARMED` in large glowing text
- Creator's 6-digit code displayed as `text-6xl` glowing digits
- Management URL in a monospace block with `[COPY LINK]` button
- One-time-access warning in amber

---

### 5.2 Unlock Ritual (`/unlock/[unlockToken]`) — "AUTHORIZATION TERMINAL"

**Header bar:** Mission title | `[X/N AUTHORIZED]` counter | horizontal progress bar (phosphor green fill)

**Participant grid (CSS grid, column count by participant count: 1–2 → 1 col, 3–4 → 2 cols, 5+ → 3 cols):**

Each participant occupies a "station panel":
```
┌─────────────────────┐
│  STATION 01         │
│  ─────────────────  │
│  Jane Smith         │
│                     │
│  STATUS: AWAITING   │
│  ▣ ▣ ▣ ▣ ▣ ▣       │  ← code slot indicators
└─────────────────────┘
```
Active station panel has a brighter border and subtle background glow.

**Code input (bottom, full width):**
```
ENTER AUTHORIZATION CODE ▶  [ _ ][ _ ][ _ ][ _ ][ _ ][ _ ]
```
Six individual digit inputs, monospace, large. Tab/arrow moves between slots.

**Detonated state:** Full-screen alert — red wash overlay, `⚠ DETONATION DETECTED` header, 24-hour countdown in amber digits, all station panels switch to red borders.

**Locked/expired states:** Amber wash, descriptive message, no input shown.

---

### 5.3 Manage Page (`/manage/[managementToken]`) — "MISSION CONTROL"

**Header bar:** `MISSION CONTROL` | mission title

**Panel layout:**
- **Top-left — YOUR AUTHORIZATION CODE:** Creator's code in large glowing digits
- **Top-right — UNLOCK ENDPOINT:** Shared URL in monospace box, `[COPY LINK]` button
- **Bottom — OPERATIVE ROSTER:** Full-width table. Columns: `#`, `NAME`, `EMAIL`, `STATUS`, `ACTION`. Action column: `[RESEND AUTHORIZATION]` button per row, flashes on success.

**Lockout banner (conditional):** Full-width amber strip above panels when detonated — `⚠ LOCKOUT ACTIVE` + `Countdown` component showing time remaining.

**Danger zone:** Separate red-bordered panel at page bottom, isolated visually: `PERMANENT DELETION` label, delete button, confirmation dialog styled as a terminal prompt (`CONFIRM DELETION? [Y/N]`).

---

### 5.4 View Page (`/view/[viewToken]`) — "PAYLOAD DECRYPT"

**Initial state:** Full-screen dark background, scan-line animation sweeping top-to-bottom, `DECRYPTING PAYLOAD...` in phosphor text below.

**Revealed state:** Media displays inside a `CLASSIFIED` document frame — corner brackets, dim border, a `PAYLOAD DECRYPTED — SINGLE-USE ACCESS` label above. Frame glows on entry then dims to resting state.

**Re-locked state:** `PAYLOAD SECURED — ACCESS REVOKED` in large phosphor text, sub-text in dim: `This payload has already been accessed.`

**Unlock landing (`/unlock`):** Single panel, center screen — `ENTER MISSION ID` label, text input, `[PROCEED]` button.

---

## 6. Animations

All Framer Motion. No animation alters business logic or timing (e.g., the 24-hour lockout countdown is unchanged).

### 6.1 Page Mount — `TerminalReveal`

Shared wrapper component. On mount: content starts at `opacity: 0`, a phosphor scan line sweeps top-to-bottom over 300ms, then content fades to `opacity: 1` over 200ms.

### 6.2 Code Digit Entry

Each digit slot: on value change, flash to `--color-phosphor` brightness then settle over 150ms. On 6th digit entered: full input row pulses once (scale 1.0 → 1.02 → 1.0) before auto-submit.

### 6.3 Key Verified — Station Panel

Framer Motion `variants` on each station panel. On `AUTHORIZED` state:
1. Border flashes white (80ms)
2. Settles to bright `--color-phosphor` (200ms)
3. Status label cross-fades `AWAITING` → `AUTHORIZED` (150ms)
4. Glow pulse radiates outward (box-shadow keyframes, 400ms)

Each panel animates independently (not orchestrated), so staggered verifications feel naturally satisfying.

### 6.4 Detonation Sequence

Triggered on wrong-code API response. Five-step sequence orchestrated via Framer Motion:

1. Full-viewport red overlay flashes in and out (80ms fade in, 80ms hold, 80ms fade out)
2. Page `x` shake: `[0, -12, 12, -8, 8, -4, 4, 0]` over 500ms
3. All station panels transition to `--color-alert` borders simultaneously
4. `⚠ DETONATION DETECTED` types in character by character (staggered `<motion.span>` children, 30ms delay each)
5. Countdown fades up in amber (`opacity: 0 → 1`, 400ms)

### 6.5 Final Unlock

All codes verified. Sequence:
1. Station panels stagger to full phosphor green (80ms apart, `staggerChildren`)
2. `ALL KEYS VERIFIED — REDIRECTING` pulses twice (scale 1.0 → 1.03 → 1.0, 300ms each)
3. Full-screen phosphor green flash on exit (Framer Motion `AnimatePresence` exit variant)
4. Redirect fires

### 6.6 Payload Reveal

On view page, after signed URL is fetched:
1. Scan line sweeps top-to-bottom (800ms, CSS or Framer Motion `y` from `-100%` to `100%`)
2. `DECRYPTING PAYLOAD...` text fades out (300ms)
3. Media element fades in (600ms) with subtle scale `0.97 → 1.0`
4. `CLASSIFIED` frame border glow pulses once then dims to resting

### 6.7 Micro-interactions

- **Button hover:** `box-shadow` transition to glow, 150ms
- **`[COPY]` / `[RESEND]` click:** button flashes bright phosphor then dims to confirm action
- **`ARM BROCODE` hold:** fill animation progresses left-to-right over 500ms; releases if pointer leaves

---

## 7. Component Inventory

New shared components to create in `app/components/`:

| Component | Purpose |
|---|---|
| `TerminalReveal` | Page-mount scan animation wrapper |
| `PageHeader` | Full-width header bar with title + status indicator |
| `Panel` | Labeled instrument panel wrapper (border, bg, header strip) |
| `GlowButton` | Button with phosphor glow hover + click flash |
| `HoldButton` | `ARM BROCODE`-style button with hold-to-confirm |
| `CodeDisplay` | Large glowing 6-digit code readout |
| `CodeInput` | Six individual digit inputs with entry animation |
| `StationPanel` | Participant card with verified/detonated state variants |
| `CRTOverlay` | Fixed full-viewport scanline + vignette overlay |
| `StatusIndicator` | Blinking dot + label for header bar |

`Countdown` (existing) is kept and restyled.

---

## 8. Files Touched

| File | Change |
|---|---|
| `app/globals.css` | Replace color tokens, add CRT CSS, update `@theme` block |
| `app/layout.tsx` | Add `CRTOverlay`, switch to Geist Mono only, update body classes |
| `app/page.tsx` | Full layout rewrite — 2-panel create form + armed state |
| `app/unlock/page.tsx` | Reskin to single panel with terminal input |
| `app/unlock/[unlockToken]/page.tsx` | Full layout rewrite — station grid + code input |
| `app/manage/[managementToken]/page.tsx` | Full layout rewrite — 3-panel control room |
| `app/view/[viewToken]/page.tsx` | Full layout rewrite — decrypt sequence + classified frame |
| `app/components/Countdown.tsx` | Restyle only (amber digits, phosphor label) |
| `app/components/*.tsx` | New components per inventory above |
| `package.json` / `pnpm-lock.yaml` | Add `framer-motion` |

---

## 9. Out of Scope

- No changes to API routes, database, email templates, or business logic
- No mobile-specific layout changes (responsive behaviour can be addressed in a follow-up)
- No accessibility audit (separate task)
- No dark/light mode toggle (design is dark-only)
