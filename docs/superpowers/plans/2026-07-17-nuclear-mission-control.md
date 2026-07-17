# Nuclear Mission Control — Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Brocode's entire UI from a minimal utilitarian card layout to a Cold War–era nuclear mission control terminal with cinematic Framer Motion animations.

**Architecture:** All pages move from centered single-column cards to full-viewport multi-panel instrument boards. A shared component library (10 new components in `app/components/`) handles the phosphor aesthetic and animation primitives. Framer Motion orchestrates all multi-step animation sequences. No API routes, business logic, or database code is touched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS v4 (CSS-first via `@theme` in `app/globals.css`, no `tailwind.config`), Framer Motion (new dependency), Geist Mono font (already in stack).

## Global Constraints

- Preserve all `data-testid` attributes exactly — E2E tests in `e2e/` depend on them
- No changes to any file under `app/api/`, `lib/`, `prisma/`, or `emails/`
- All color values must be used via CSS custom properties (e.g. `var(--color-phosphor)`), never hardcoded
- Tailwind CSS v4: use bracket notation for custom tokens e.g. `bg-[var(--color-phosphor-faint)]`
- Framer Motion: all animated page components require `'use client'` — all page files already have it
- Keep all existing TypeScript types and state logic — only touch JSX and styling
- `pnpm` is the package manager — use `pnpm add`, never `npm install`
- E2E compat: `submit` button must fire on a plain click (E2E programmatic clicks are < 100ms); `code` input must be fillable by Playwright; `delete` button must trigger `window.confirm()` (E2E test uses `page.on('dialog', ...)`)

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Create | `app/components/CRTOverlay.tsx` | Fixed full-viewport scanlines + vignette, `pointer-events: none` |
| Create | `app/components/Panel.tsx` | Labeled instrument panel wrapper |
| Create | `app/components/PageHeader.tsx` | Full-width header bar: title left, slot right |
| Create | `app/components/StatusIndicator.tsx` | Blinking dot + label |
| Create | `app/components/GlowButton.tsx` | Button with phosphor glow hover + click flash |
| Create | `app/components/HoldButton.tsx` | Hold-to-confirm button with fill animation; fires immediately on fast click (E2E compat) |
| Create | `app/components/CodeDisplay.tsx` | Large glowing digit readout for displaying a code |
| Create | `app/components/CodeInput.tsx` | Six visual digit boxes + invisible overlay `<input>` for E2E compat |
| Create | `app/components/StationPanel.tsx` | Participant card with `awaiting`/`authorized`/`detonated` state variants |
| Create | `app/components/TerminalReveal.tsx` | Page-mount scan-line + fade-in wrapper |
| Modify | `app/globals.css` | Replace color tokens, add CRT CSS, update `@theme` block |
| Modify | `app/layout.tsx` | Import `CRTOverlay`, switch to Geist Mono only, update metadata |
| Modify | `app/components/Countdown.tsx` | Restyle: amber digits, phosphor label (no logic change) |
| Modify | `app/page.tsx` | Full layout rewrite — 2-panel create form + armed readout |
| Modify | `app/unlock/page.tsx` | Reskin to single panel with terminal input |
| Modify | `app/unlock/[unlockToken]/page.tsx` | Full layout rewrite — station grid + code input + detonation animation |
| Modify | `app/manage/[managementToken]/page.tsx` | Full layout rewrite — 3-panel control room; keep `window.confirm()` |
| Modify | `app/view/[viewToken]/page.tsx` | Full layout rewrite — decrypt sequence + classified frame |

---

### Task 1: Install Framer Motion and replace design system foundation

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: CSS custom properties `--color-bg`, `--color-phosphor`, `--color-phosphor-dim`, `--color-phosphor-faint`, `--color-amber`, `--color-alert`, `--color-panel-border` globally available; Geist Mono as the only font.

- [ ] **Step 1: Install framer-motion**

```bash
pnpm add framer-motion
```

Expected: `Done in Xs` with `framer-motion` added to `package.json`.

- [ ] **Step 2: Replace app/globals.css entirely**

```css
@import "tailwindcss";

:root {
  --color-bg: #080c08;
  --color-phosphor: #00ff41;
  --color-phosphor-dim: #00aa2a;
  --color-phosphor-faint: #1a3a1a;
  --color-amber: #ffb000;
  --color-alert: #ff2222;
  --color-panel-border: #0d2a0d;
}

@theme inline {
  --color-background: var(--color-bg);
  --color-foreground: var(--color-phosphor);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--color-bg);
  color: var(--color-phosphor);
  font-family: var(--font-geist-mono), monospace;
}
```

- [ ] **Step 3: Replace app/layout.tsx — remove Geist Sans, update metadata**

```tsx
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Brocode",
  description: "Shared-key media unlock ceremony",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col"
        style={{ background: "var(--color-bg)", color: "var(--color-phosphor)" }}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx package.json pnpm-lock.yaml
git commit -m "feat: install framer-motion and replace design system foundation"
```

---

### Task 2: Create CRTOverlay, Panel, PageHeader, StatusIndicator

**Files:**
- Create: `app/components/CRTOverlay.tsx`
- Create: `app/components/Panel.tsx`
- Create: `app/components/PageHeader.tsx`
- Create: `app/components/StatusIndicator.tsx`

**Interfaces:**
- Produces:
  - `CRTOverlay()` — no props
  - `Panel({ label: string, children: ReactNode, className?: string })` — labeled panel wrapper
  - `PageHeader({ title: string, right?: ReactNode })` — full-width header bar
  - `StatusIndicator({ label: string, color?: 'phosphor' | 'amber' | 'alert' })` — blinking dot; defaults to `'phosphor'`

- [ ] **Step 1: Create app/components/CRTOverlay.tsx**

```tsx
export function CRTOverlay() {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </>
  )
}
```

- [ ] **Step 2: Create app/components/Panel.tsx**

```tsx
interface PanelProps {
  label: string
  children: React.ReactNode
  className?: string
}

export function Panel({ label, children, className = '' }: PanelProps) {
  return (
    <div
      className={`flex flex-col border ${className}`}
      style={{ borderColor: 'var(--color-panel-border)', background: 'var(--color-phosphor-faint)' }}
    >
      <div
        className="px-3 py-1 text-xs tracking-widest uppercase border-b shrink-0"
        style={{ borderColor: 'var(--color-panel-border)', color: 'var(--color-phosphor-dim)' }}
      >
        {label}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: Create app/components/StatusIndicator.tsx**

```tsx
'use client'

type StatusColor = 'phosphor' | 'amber' | 'alert'

const colorVar: Record<StatusColor, string> = {
  phosphor: 'var(--color-phosphor)',
  amber: 'var(--color-amber)',
  alert: 'var(--color-alert)',
}

interface StatusIndicatorProps {
  label: string
  color?: StatusColor
}

export function StatusIndicator({ label, color = 'phosphor' }: StatusIndicatorProps) {
  const c = colorVar[color]
  return (
    <span className="flex items-center gap-2 text-xs tracking-widest uppercase">
      <span
        className="inline-block w-2 h-2 rounded-full animate-pulse"
        style={{ background: c, boxShadow: `0 0 6px ${c}` }}
      />
      <span style={{ color: c }}>{label}</span>
    </span>
  )
}
```

- [ ] **Step 4: Create app/components/PageHeader.tsx**

```tsx
interface PageHeaderProps {
  title: string
  right?: React.ReactNode
}

export function PageHeader({ title, right }: PageHeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-6 py-3 border-b shrink-0"
      style={{ borderColor: 'var(--color-panel-border)' }}
    >
      <span
        className="text-sm tracking-widest uppercase font-bold"
        style={{
          color: 'var(--color-phosphor)',
          textShadow: '0 0 4px var(--color-phosphor), 0 0 12px var(--color-phosphor)',
        }}
      >
        {title}
      </span>
      {right && <div>{right}</div>}
    </header>
  )
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/components/CRTOverlay.tsx app/components/Panel.tsx app/components/PageHeader.tsx app/components/StatusIndicator.tsx
git commit -m "feat: add CRTOverlay, Panel, PageHeader, StatusIndicator components"
```

---

### Task 3: Create GlowButton and HoldButton

**Files:**
- Create: `app/components/GlowButton.tsx`
- Create: `app/components/HoldButton.tsx`

**Interfaces:**
- Produces:
  - `GlowButton({ children, onClick?, type?, disabled?, color?, className?, 'data-testid'? })` — glow hover + click flash; `color` is `'phosphor' | 'alert'`, default `'phosphor'`
  - `HoldButton({ children, onActivate, disabled?, holdMs?, 'data-testid'? })` — hold-to-confirm; fires after `holdMs` ms (default 500); also fires immediately on a fast click (< 100ms) for E2E compat

- [ ] **Step 1: Create app/components/GlowButton.tsx**

```tsx
'use client'

import { useState } from 'react'

type GlowColor = 'phosphor' | 'alert'

const colorVar: Record<GlowColor, string> = {
  phosphor: 'var(--color-phosphor)',
  alert: 'var(--color-alert)',
}

interface GlowButtonProps {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  color?: GlowColor
  className?: string
  'data-testid'?: string
}

export function GlowButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  color = 'phosphor',
  className = '',
  'data-testid': testId,
}: GlowButtonProps) {
  const [flashing, setFlashing] = useState(false)
  const c = colorVar[color]

  function handleClick() {
    setFlashing(true)
    setTimeout(() => setFlashing(false), 150)
    onClick?.()
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled}
      data-testid={testId}
      className={`px-4 py-2 text-xs tracking-widest uppercase border transition-all duration-150 disabled:opacity-40 cursor-pointer ${className}`}
      style={{
        borderColor: c,
        color: flashing ? 'var(--color-bg)' : c,
        background: flashing ? c : 'transparent',
        textShadow: flashing ? 'none' : `0 0 4px ${c}`,
        boxShadow: `0 0 ${flashing ? '16px' : '4px'} ${c}`,
      }}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Create app/components/HoldButton.tsx**

```tsx
'use client'

import { useCallback, useRef, useState } from 'react'

interface HoldButtonProps {
  children: React.ReactNode
  onActivate: () => void
  disabled?: boolean
  holdMs?: number
  'data-testid'?: string
}

export function HoldButton({
  children,
  onActivate,
  disabled = false,
  holdMs = 500,
  'data-testid': testId,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  const cancel = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    startRef.current = null
    setProgress(0)
  }, [])

  const tick = useCallback(
    (now: number) => {
      if (startRef.current === null) return
      const elapsed = now - startRef.current
      const p = Math.min(elapsed / holdMs, 1)
      setProgress(p)
      if (p >= 1) {
        cancel()
        onActivate()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [holdMs, onActivate, cancel],
  )

  function start() {
    if (disabled) return
    startRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)
  }

  function release() {
    if (startRef.current !== null) {
      const elapsed = performance.now() - startRef.current
      // Fast click (< 100ms) is treated as programmatic/E2E — fire immediately
      if (elapsed < 100) {
        cancel()
        onActivate()
        return
      }
    }
    cancel()
  }

  return (
    <button
      type="button"
      onMouseDown={start}
      onMouseUp={release}
      onMouseLeave={cancel}
      onTouchStart={start}
      onTouchEnd={release}
      disabled={disabled}
      data-testid={testId}
      className="relative w-full overflow-hidden py-4 text-xs tracking-widest uppercase border disabled:opacity-40 select-none cursor-pointer"
      style={{
        borderColor: 'var(--color-phosphor)',
        color: progress > 0 ? 'var(--color-bg)' : 'var(--color-phosphor)',
        textShadow: progress > 0 ? 'none' : '0 0 4px var(--color-phosphor)',
        boxShadow: '0 0 4px var(--color-phosphor)',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: 'var(--color-phosphor)',
          transformOrigin: 'left',
          transform: `scaleX(${progress})`,
          transition: progress === 0 ? 'transform 0.05s' : 'none',
        }}
      />
      <span className="relative">{children}</span>
    </button>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/GlowButton.tsx app/components/HoldButton.tsx
git commit -m "feat: add GlowButton and HoldButton components"
```

---

### Task 4: Create CodeDisplay and CodeInput

**Files:**
- Create: `app/components/CodeDisplay.tsx`
- Create: `app/components/CodeInput.tsx`

**Interfaces:**
- Produces:
  - `CodeDisplay({ code: string })` — renders each character as an individually glowing span
  - `CodeInput({ value: string, onChange: (v: string) => void, onComplete: (code: string) => void, disabled?: boolean, 'data-testid'?: string })` — six visual digit boxes with an `opacity: 0.01` overlay `<input>` that Playwright can `fill()`

- [ ] **Step 1: Create app/components/CodeDisplay.tsx**

```tsx
export function CodeDisplay({ code }: { code: string }) {
  return (
    <div className="flex gap-2 items-end flex-wrap" data-testid="code-display">
      {code.split('').map((d, i) => (
        <span
          key={i}
          className="text-6xl font-bold tabular-nums leading-none"
          style={{
            color: 'var(--color-phosphor)',
            textShadow:
              '0 0 4px var(--color-phosphor), 0 0 12px var(--color-phosphor)',
          }}
        >
          {d}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create app/components/CodeInput.tsx**

```tsx
'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'

interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  onComplete: (code: string) => void
  disabled?: boolean
  'data-testid'?: string
}

export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  'data-testid': testId,
}: CodeInputProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLInputElement>(null)
  const digits = value.padEnd(6, ' ').slice(0, 6).split('')

  function handleOverlayChange(e: React.ChangeEvent<HTMLInputElement>) {
    const filtered = e.target.value.replace(/\D/g, '').slice(0, 6)
    onChange(filtered)
    if (filtered.length === 6) onComplete(filtered)
  }

  return (
    <motion.div
      ref={containerRef}
      className="relative flex items-center gap-3 cursor-text"
      animate={value.length === 6 ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={() => overlayRef.current?.focus()}
    >
      <span
        className="text-xs tracking-widest uppercase shrink-0"
        style={{ color: 'var(--color-phosphor-dim)' }}
      >
        Enter Authorization Code ▶
      </span>

      {/* Visual digit boxes */}
      <div className="flex gap-2 pointer-events-none" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const d = digits[i]
          const filled = d !== ' ' && d !== undefined
          return (
            <motion.span
              key={i}
              className="w-10 h-12 flex items-center justify-center text-xl font-bold border"
              style={{
                borderColor: filled ? 'var(--color-phosphor)' : 'var(--color-panel-border)',
                color: 'var(--color-phosphor)',
                textShadow: filled
                  ? '0 0 4px var(--color-phosphor), 0 0 12px var(--color-phosphor)'
                  : 'none',
              }}
              animate={filled ? { opacity: [0.5, 1], scale: [0.9, 1] } : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
            >
              {filled ? d : ''}
            </motion.span>
          )
        })}
      </div>

      {/*
        Overlay input: not display:none or visibility:hidden so Playwright can fill() it.
        opacity: 0.01 is above 0 — Playwright treats this as visible/actionable.
        Positioned absolute over the digit boxes area to capture real user clicks too.
      */}
      <input
        ref={overlayRef}
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={handleOverlayChange}
        disabled={disabled}
        data-testid={testId}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '260px', // covers the 6 digit boxes
          opacity: 0.01,
          color: 'transparent',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          cursor: 'default',
        }}
      />
    </motion.div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/CodeDisplay.tsx app/components/CodeInput.tsx
git commit -m "feat: add CodeDisplay and CodeInput components"
```

---

### Task 5: Create StationPanel and TerminalReveal

**Files:**
- Create: `app/components/StationPanel.tsx`
- Create: `app/components/TerminalReveal.tsx`

**Interfaces:**
- Produces:
  - `StationPanel({ name: string, index: number, status: StationStatus, active?: boolean })` — participant card; `StationStatus = 'awaiting' | 'authorized' | 'detonated'` (exported type)
  - `TerminalReveal({ children: ReactNode })` — scan-line sweep + fade-in on mount

- [ ] **Step 1: Create app/components/StationPanel.tsx**

```tsx
'use client'

import { motion } from 'framer-motion'

export type StationStatus = 'awaiting' | 'authorized' | 'detonated'

interface StationPanelProps {
  name: string
  index: number
  status: StationStatus
  active?: boolean
}

const cfg = {
  awaiting: {
    label: 'AWAITING',
    border: 'var(--color-panel-border)',
    text: 'var(--color-phosphor-dim)',
    glow: 'none',
  },
  authorized: {
    label: 'AUTHORIZED',
    border: 'var(--color-phosphor)',
    text: 'var(--color-phosphor)',
    glow: '0 0 8px var(--color-phosphor), 0 0 24px var(--color-phosphor)',
  },
  detonated: {
    label: 'DETONATED',
    border: 'var(--color-alert)',
    text: 'var(--color-alert)',
    glow: '0 0 8px var(--color-alert), 0 0 24px var(--color-alert)',
  },
}

export function StationPanel({ name, index, status, active = false }: StationPanelProps) {
  const c = cfg[status]
  const num = String(index + 1).padStart(2, '0')

  return (
    <motion.div
      className="flex flex-col p-4 border h-full"
      style={{ background: 'var(--color-phosphor-faint)' }}
      animate={{
        borderColor: c.border,
        boxShadow:
          c.glow !== 'none'
            ? c.glow
            : active
              ? 'inset 0 0 16px rgba(0,255,65,0.08)'
              : 'none',
      }}
      transition={{ duration: 0.3 }}
    >
      <div
        className="text-xs tracking-widest uppercase mb-2"
        style={{ color: 'var(--color-phosphor-dim)' }}
      >
        Station {num}
      </div>
      <div
        className="font-bold mb-3"
        style={{ color: 'var(--color-phosphor)', textShadow: '0 0 4px var(--color-phosphor)' }}
      >
        {name}
      </div>
      <motion.div
        className="text-xs tracking-widest uppercase font-bold mb-3"
        animate={{ color: c.text }}
        transition={{ duration: 0.15 }}
        style={{ textShadow: c.glow !== 'none' ? `0 0 4px ${c.text}` : 'none' }}
      >
        STATUS: {c.label}
      </motion.div>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="w-4 h-4 border flex items-center justify-center text-xs"
            style={{
              borderColor: status === 'authorized' ? 'var(--color-phosphor)' : 'var(--color-panel-border)',
              color: status === 'authorized' ? 'var(--color-phosphor)' : 'var(--color-phosphor-dim)',
            }}
          >
            {status === 'authorized' ? '■' : '▣'}
          </span>
        ))}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Create app/components/TerminalReveal.tsx**

```tsx
'use client'

import { motion } from 'framer-motion'

export function TerminalReveal({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden flex-1 flex flex-col">
      <motion.div
        aria-hidden="true"
        className="absolute left-0 right-0 h-0.5 pointer-events-none"
        style={{
          background: 'var(--color-phosphor)',
          boxShadow: '0 0 16px 4px var(--color-phosphor)',
          zIndex: 50,
        }}
        initial={{ top: 0 }}
        animate={{ top: '100%' }}
        transition={{ duration: 0.4, ease: 'linear' }}
      />
      <motion.div
        className="flex-1 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.2 }}
      >
        {children}
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/StationPanel.tsx app/components/TerminalReveal.tsx
git commit -m "feat: add StationPanel and TerminalReveal components"
```

---

### Task 6: Wire CRTOverlay into layout and restyle Countdown

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/components/Countdown.tsx`

**Interfaces:**
- Consumes: `CRTOverlay` from `app/components/CRTOverlay.tsx`
- Produces: CRT overlay on every page; Countdown restyled with amber glow (logic unchanged, `data-testid="countdown"` preserved)

- [ ] **Step 1: Update app/layout.tsx to import CRTOverlay**

```tsx
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { CRTOverlay } from "@/app/components/CRTOverlay";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Brocode",
  description: "Shared-key media unlock ceremony",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col"
        style={{ background: "var(--color-bg)", color: "var(--color-phosphor)" }}
      >
        <CRTOverlay />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Restyle app/components/Countdown.tsx (logic unchanged)**

```tsx
'use client'

import { useEffect, useState } from 'react'

export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, new Date(until).getTime() - now)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return (
    <span
      data-testid="countdown"
      className="font-bold tabular-nums tracking-widest"
      style={{
        color: 'var(--color-amber)',
        textShadow: '0 0 4px var(--color-amber), 0 0 12px var(--color-amber)',
      }}
    >
      {h}h {m}m {s}s
    </span>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/components/Countdown.tsx
git commit -m "feat: add CRTOverlay to layout, restyle Countdown"
```

---

### Task 7: Rewrite the Create page

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Panel`, `StatusIndicator`, `GlowButton`, `HoldButton`, `CodeDisplay`, `TerminalReveal` from `app/components/`
- Produces: 2-panel create form + armed readout; preserves `data-testid`: `creator-name`, `title`, `file`, `contact-name-{i}`, `contact-email-{i}`, `add-contact`, `submit`, `creator-code`, `manage-link`, `error`

- [ ] **Step 1: Rewrite app/page.tsx entirely**

```tsx
'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageHeader } from '@/app/components/PageHeader'
import { Panel } from '@/app/components/Panel'
import { StatusIndicator } from '@/app/components/StatusIndicator'
import { GlowButton } from '@/app/components/GlowButton'
import { HoldButton } from '@/app/components/HoldButton'
import { CodeDisplay } from '@/app/components/CodeDisplay'
import { TerminalReveal } from '@/app/components/TerminalReveal'

type Contact = { name: string; email: string }
type Result = { managementToken: string; unlockToken: string; creatorCode: string }

function inputStyle(focused: boolean) {
  return {
    borderColor: focused ? 'var(--color-phosphor)' : 'var(--color-panel-border)',
    color: 'var(--color-phosphor)',
    caretColor: 'var(--color-phosphor)',
  }
}

export default function CreatePage() {
  const [creatorName, setCreatorName] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([{ name: '', email: '' }])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  function updateContact(i: number, patch: Partial<Contact>) {
    setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }

  async function submit() {
    setError(null)
    if (!file) return setError('Choose a file')
    setBusy(true)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('creatorName', creatorName)
      if (title) form.set('title', title)
      form.set('contacts', JSON.stringify(contacts))
      const res = await fetch('/api/brocodes', { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed')
      setResult(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const manageUrl =
    result && typeof window !== 'undefined'
      ? `${window.location.origin}/manage/${result.managementToken}`
      : ''

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="BROCODE LAUNCH SYSTEM v1.0"
        right={
          <StatusIndicator
            label={busy ? 'ARMING…' : result ? 'ARMED' : 'SYSTEM READY'}
            color={result ? 'alert' : 'phosphor'}
          />
        }
      />
      <TerminalReveal>
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="armed"
              className="flex-1 flex flex-col items-center justify-center p-8 gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div
                className="text-2xl font-bold tracking-widest uppercase"
                style={{
                  color: 'var(--color-phosphor)',
                  textShadow: '0 0 4px var(--color-phosphor), 0 0 20px var(--color-phosphor)',
                }}
              >
                SYSTEM STATUS: ARMED
              </div>

              <Panel label="YOUR AUTHORIZATION CODE" className="w-full max-w-lg">
                <CodeDisplay code={result.creatorCode} />
                {/* sr-only span preserves data-testid for E2E text assertion */}
                <span data-testid="creator-code" className="sr-only">
                  {result.creatorCode}
                </span>
              </Panel>

              <Panel label="MANAGEMENT ENDPOINT — ONE-TIME ACCESS" className="w-full max-w-lg">
                <div
                  className="text-xs break-all mb-3"
                  style={{ color: 'var(--color-phosphor-dim)' }}
                >
                  <span data-testid="manage-link" style={{ color: 'var(--color-phosphor)' }}>
                    {manageUrl}
                  </span>
                </div>
                <GlowButton onClick={() => copyLink(manageUrl)}>
                  {copied ? '✓ COPIED' : '[COPY LINK]'}
                </GlowButton>
                <p
                  className="mt-3 text-xs tracking-widest"
                  style={{ color: 'var(--color-amber)', textShadow: '0 0 4px var(--color-amber)' }}
                >
                  ⚠ THIS URL IS SHOWN ONCE. SECURE IT NOW.
                </p>
              </Panel>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              className="flex-1 flex flex-col overflow-hidden"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex-1 grid grid-cols-2 overflow-hidden">
                {/* Left: mission parameters */}
                <Panel label="MISSION PARAMETERS" className="overflow-y-auto">
                  <div className="space-y-4">
                    <label className="block">
                      <span
                        className="text-xs tracking-widest uppercase block mb-1"
                        style={{ color: 'var(--color-phosphor-dim)' }}
                      >
                        Operative Callsign
                      </span>
                      <input
                        required
                        value={creatorName}
                        onChange={(e) => setCreatorName(e.target.value)}
                        data-testid="creator-name"
                        onFocus={() => setFocused('name')}
                        onBlur={() => setFocused(null)}
                        className="w-full bg-transparent border p-2 text-sm outline-none"
                        style={inputStyle(focused === 'name')}
                      />
                    </label>

                    <label className="block">
                      <span
                        className="text-xs tracking-widest uppercase block mb-1"
                        style={{ color: 'var(--color-phosphor-dim)' }}
                      >
                        Mission Designation (optional)
                      </span>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        data-testid="title"
                        onFocus={() => setFocused('title')}
                        onBlur={() => setFocused(null)}
                        className="w-full bg-transparent border p-2 text-sm outline-none"
                        style={inputStyle(focused === 'title')}
                      />
                    </label>

                    <fieldset className="space-y-2">
                      <legend
                        className="text-xs tracking-widest uppercase mb-2"
                        style={{ color: 'var(--color-phosphor-dim)' }}
                      >
                        Operatives (1–10)
                      </legend>
                      {contacts.map((c, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <span
                            className="text-xs w-6 shrink-0 tabular-nums"
                            style={{ color: 'var(--color-phosphor-dim)' }}
                          >
                            [{String(i + 1).padStart(2, '0')}]
                          </span>
                          <input
                            placeholder="name"
                            value={c.name}
                            onChange={(e) => updateContact(i, { name: e.target.value })}
                            data-testid={`contact-name-${i}`}
                            onFocus={() => setFocused(`cn${i}`)}
                            onBlur={() => setFocused(null)}
                            className="w-1/2 bg-transparent border p-2 text-sm outline-none"
                            style={inputStyle(focused === `cn${i}`)}
                          />
                          <input
                            placeholder="email"
                            value={c.email}
                            onChange={(e) => updateContact(i, { email: e.target.value })}
                            data-testid={`contact-email-${i}`}
                            onFocus={() => setFocused(`ce${i}`)}
                            onBlur={() => setFocused(null)}
                            className="w-1/2 bg-transparent border p-2 text-sm outline-none"
                            style={inputStyle(focused === `ce${i}`)}
                          />
                          {contacts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setContacts((cs) => cs.filter((_, idx) => idx !== i))}
                              className="text-xs shrink-0"
                              style={{ color: 'var(--color-alert)' }}
                            >
                              [X]
                            </button>
                          )}
                        </div>
                      ))}
                      <GlowButton
                        disabled={contacts.length >= 10}
                        onClick={() => setContacts((cs) => [...cs, { name: '', email: '' }])}
                        data-testid="add-contact"
                      >
                        [+ ADD OPERATIVE]
                      </GlowButton>
                    </fieldset>

                    {error && (
                      <p
                        className="text-xs tracking-widest"
                        data-testid="error"
                        style={{ color: 'var(--color-alert)' }}
                      >
                        ⚠ {error}
                      </p>
                    )}
                  </div>
                </Panel>

                {/* Right: payload */}
                <Panel label="PAYLOAD" className="overflow-y-auto">
                  <label className="block cursor-pointer">
                    <input
                      required
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      data-testid="file"
                      className="sr-only"
                    />
                    <div
                      className="border-2 border-dashed p-8 text-center flex flex-col items-center gap-3"
                      style={{
                        borderColor: file ? 'var(--color-phosphor)' : 'var(--color-panel-border)',
                        boxShadow: file ? '0 0 8px var(--color-phosphor)' : 'none',
                      }}
                    >
                      {file ? (
                        <>
                          <span
                            className="text-xs tracking-widest uppercase"
                            style={{
                              color: 'var(--color-phosphor)',
                              textShadow: '0 0 4px var(--color-phosphor)',
                            }}
                          >
                            ✓ PAYLOAD LOADED
                          </span>
                          <span className="text-xs break-all" style={{ color: 'var(--color-phosphor-dim)' }}>
                            {file.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            className="text-sm tracking-widest uppercase"
                            style={{ color: 'var(--color-phosphor-dim)' }}
                          >
                            DROP PAYLOAD OR CLICK TO UPLOAD
                          </span>
                          <span className="text-xs" style={{ color: 'var(--color-phosphor-dim)' }}>
                            Image or video · max 5 MB
                          </span>
                        </>
                      )}
                    </div>
                  </label>
                </Panel>
              </div>

              <div className="p-4 border-t shrink-0" style={{ borderColor: 'var(--color-panel-border)' }}>
                <HoldButton onActivate={submit} disabled={busy} data-testid="submit">
                  {busy ? 'ARMING BROCODE…' : '▶ ARM BROCODE — HOLD TO CONFIRM'}
                </HoldButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </TerminalReveal>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify create page**

```bash
pnpm dev
```

Open http://localhost:3000. Verify:
- Dark `#080c08` background; CRT scanlines + vignette visible
- Header: "BROCODE LAUNCH SYSTEM v1.0" | blinking green dot + "SYSTEM READY"
- Two-panel layout: MISSION PARAMETERS left, PAYLOAD right
- Inputs gain phosphor border on focus
- Hold button fills phosphor on mouse-down, fires after ~500ms; plain click fires immediately
- After submit: ARMED readout with large glowing digit code and management URL

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: rewrite create page as nuclear mission control 2-panel layout"
```

---

### Task 8: Rewrite the Unlock Landing page

**Files:**
- Modify: `app/unlock/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Panel`, `GlowButton`, `TerminalReveal`, `StatusIndicator`
- Produces: Single centered panel; preserves `data-testid="asset-id"` and `data-testid="go"`

- [ ] **Step 1: Rewrite app/unlock/page.tsx entirely**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PageHeader } from '@/app/components/PageHeader'
import { Panel } from '@/app/components/Panel'
import { GlowButton } from '@/app/components/GlowButton'
import { TerminalReveal } from '@/app/components/TerminalReveal'
import { StatusIndicator } from '@/app/components/StatusIndicator'

export default function UnlockLanding() {
  const router = useRouter()
  const [assetId, setAssetId] = useState('')
  const [focused, setFocused] = useState(false)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="BROCODE AUTHORIZATION TERMINAL"
        right={<StatusIndicator label="AWAITING INPUT" />}
      />
      <TerminalReveal>
        <div className="flex-1 flex items-center justify-center p-8">
          <Panel label="ENTER MISSION ID" className="w-full max-w-md">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (assetId.trim()) router.push(`/unlock/${assetId.trim()}`)
              }}
              className="space-y-4"
            >
              <div>
                <span
                  className="text-xs tracking-widest uppercase block mb-1"
                  style={{ color: 'var(--color-phosphor-dim)' }}
                >
                  Mission ID from your authorization email
                </span>
                <input
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  data-testid="asset-id"
                  placeholder="paste mission ID"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className="w-full bg-transparent border p-2 text-sm outline-none"
                  style={{
                    borderColor: focused ? 'var(--color-phosphor)' : 'var(--color-panel-border)',
                    color: 'var(--color-phosphor)',
                    caretColor: 'var(--color-phosphor)',
                  }}
                />
              </div>
              <GlowButton type="submit" data-testid="go">
                [PROCEED]
              </GlowButton>
            </form>
          </Panel>
        </div>
      </TerminalReveal>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/unlock/page.tsx
git commit -m "feat: rewrite unlock landing page as terminal input panel"
```

---

### Task 9: Rewrite the Unlock Ritual page

**Files:**
- Modify: `app/unlock/[unlockToken]/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Panel`, `StationPanel`, `StationStatus`, `CodeInput`, `GlowButton`, `TerminalReveal`, `StatusIndicator`, `Countdown`
- Produces: Station grid + `CodeInput` + detonation animation; preserves `data-testid`: `locked` (on the locked-state wrapper), `progress`, `participant-{name}` (on each station wrapper), `code` (on the CodeInput overlay input), `enter` (sr-only button for E2E compat)

- [ ] **Step 1: Rewrite app/unlock/[unlockToken]/page.tsx entirely**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Countdown } from '@/app/components/Countdown'
import { PageHeader } from '@/app/components/PageHeader'
import { Panel } from '@/app/components/Panel'
import { StationPanel, type StationStatus } from '@/app/components/StationPanel'
import { CodeInput } from '@/app/components/CodeInput'
import { GlowButton } from '@/app/components/GlowButton'
import { TerminalReveal } from '@/app/components/TerminalReveal'
import { StatusIndicator } from '@/app/components/StatusIndicator'

type ParticipantProgress = { id: string; name: string; matched: boolean }
type UnlockState =
  | { status: 'locked'; lockedUntil: string }
  | { status: 'in_progress'; participants: ParticipantProgress[]; matchedCount: number; total: number; expiresAt: string }
  | { status: 'expired' }
  | { status: 'detonated'; lockedUntil: string }
  | { status: 'unlocked'; viewToken: string }
  | { status: 'notfound' }

function gridClass(count: number) {
  if (count <= 2) return 'grid-cols-1'
  if (count <= 4) return 'grid-cols-2'
  return 'grid-cols-3'
}

export default function UnlockRitual() {
  const { unlockToken } = useParams<{ unlockToken: string }>()
  const router = useRouter()
  const [state, setState] = useState<UnlockState | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [detonating, setDetonating] = useState(false)
  const [detonationText, setDetonationText] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/unlock/${unlockToken}`)
    if (res.status === 404) return setState({ status: 'notfound' })
    setState(await res.json())
  }, [unlockToken])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (state?.status === 'unlocked') router.push(`/view/${state.viewToken}`)
  }, [state, router])

  async function submit(submittedCode: string) {
    if (!/^\d{6}$/.test(submittedCode)) return
    setBusy(true)
    setCode('')
    try {
      const res = await fetch(`/api/unlock/${unlockToken}/code`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: submittedCode }),
      })
      const next: UnlockState = await res.json()
      if (next.status === 'expired') return load()
      if (next.status === 'detonated') {
        setDetonating(true)
        const msg = '⚠ DETONATION DETECTED'
        // type in the message character by character
        for (let i = 1; i <= msg.length; i++) {
          setDetonationText(msg.slice(0, i))
          await new Promise((r) => setTimeout(r, 30))
        }
      }
      setState(next)
    } finally {
      setBusy(false)
    }
  }

  if (!state) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="AUTHORIZATION TERMINAL" right={<StatusIndicator label="LOADING" color="amber" />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs tracking-widest uppercase animate-pulse" style={{ color: 'var(--color-phosphor-dim)' }}>
            Establishing connection…
          </span>
        </div>
      </div>
    )
  }

  if (state.status === 'notfound') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="AUTHORIZATION TERMINAL" right={<StatusIndicator label="NOT FOUND" color="alert" />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-alert)' }}>
            Mission ID not found.
          </span>
        </div>
      </div>
    )
  }

  if (state.status === 'locked' || state.status === 'detonated') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" data-testid="locked">
        <PageHeader title="AUTHORIZATION TERMINAL" right={<StatusIndicator label="LOCKOUT ACTIVE" color="alert" />} />
        <TerminalReveal>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <motion.div
              className="text-3xl font-bold tracking-widest uppercase text-center"
              style={{
                color: 'var(--color-alert)',
                textShadow: '0 0 8px var(--color-alert), 0 0 24px var(--color-alert)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {detonating ? detonationText : '⚠ DETONATION DETECTED'}
            </motion.div>
            <Panel label="LOCKOUT DURATION" className="w-full max-w-sm text-center">
              <p className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--color-phosphor-dim)' }}>
                Unlocks in
              </p>
              <Countdown until={state.lockedUntil} />
            </Panel>
          </div>
        </TerminalReveal>
      </div>
    )
  }

  if (state.status === 'expired') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="AUTHORIZATION TERMINAL" right={<StatusIndicator label="SESSION EXPIRED" color="amber" />} />
        <div className="flex-1 flex items-center justify-center gap-4">
          <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-amber)' }}>
            Session expired.
          </span>
          <GlowButton onClick={load}>[RESTART]</GlowButton>
        </div>
      </div>
    )
  }

  if (state.status === 'unlocked') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="AUTHORIZATION TERMINAL" right={<StatusIndicator label="UNLOCKING" />} />
        <div className="flex-1 flex items-center justify-center">
          <motion.span
            className="text-xl tracking-widest uppercase font-bold"
            style={{
              color: 'var(--color-phosphor)',
              textShadow: '0 0 4px var(--color-phosphor), 0 0 20px var(--color-phosphor)',
            }}
            animate={{ scale: [1, 1.03, 1, 1.03, 1] }}
            transition={{ duration: 0.6 }}
          >
            ALL KEYS VERIFIED — REDIRECTING
          </motion.span>
        </div>
      </div>
    )
  }

  // in_progress state
  const progress = state.matchedCount / state.total

  return (
    <motion.div
      className="flex flex-col h-screen overflow-hidden"
      animate={detonating ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Red flash overlay on detonation */}
      <AnimatePresence>
        {detonating && (
          <motion.div
            className="fixed inset-0 pointer-events-none"
            style={{ background: 'var(--color-alert)', zIndex: 100 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
          />
        )}
      </AnimatePresence>

      <PageHeader
        title="AUTHORIZATION TERMINAL"
        right={
          <div className="flex items-center gap-4">
            {/* sr-only span: E2E checks toContainText('X of Y'), visual span shows mission control format */}
            <span data-testid="progress" className="sr-only">
              {state.matchedCount} of {state.total}
            </span>
            <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-phosphor)' }}>
              [{state.matchedCount}/{state.total} AUTHORIZED]
            </span>
            <div className="w-32 h-0.5 relative" style={{ background: 'var(--color-panel-border)' }}>
              <motion.div
                className="absolute inset-y-0 left-0"
                style={{ background: 'var(--color-phosphor)', boxShadow: '0 0 6px var(--color-phosphor)' }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        }
      />

      <TerminalReveal>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`flex-1 grid ${gridClass(state.participants.length)} overflow-auto`}>
            {state.participants.map((p, i) => {
              let status: StationStatus = 'awaiting'
              if (detonating) status = 'detonated'
              else if (p.matched) status = 'authorized'
              const isNext = !p.matched && state.participants.slice(0, i).every((pp) => pp.matched)
              return (
                <div key={p.id} data-testid={`participant-${p.name}`}>
                  <StationPanel name={p.name} index={i} status={status} active={isNext} />
                </div>
              )
            })}
          </div>

          <div
            className="shrink-0 p-4 border-t flex items-center gap-4"
            style={{ borderColor: 'var(--color-panel-border)' }}
          >
            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={submit}
              disabled={busy || detonating}
              data-testid="code"
            />
            {/* sr-only button preserves data-testid="enter" for E2E click() compat */}
            <button
              data-testid="enter"
              onClick={() => submit(code)}
              disabled={busy}
              className="sr-only"
            >
              Enter
            </button>
          </div>

          <p
            className="px-4 pb-2 text-xs tracking-widest"
            style={{ color: 'var(--color-phosphor-dim)' }}
          >
            One wrong code locks this for 24 hours. No retries.
          </p>
        </div>
      </TerminalReveal>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/unlock/[unlockToken]/page.tsx
git commit -m "feat: rewrite unlock ritual page with station grid and detonation animation"
```

---

### Task 10: Rewrite the Manage page

**Files:**
- Modify: `app/manage/[managementToken]/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Panel`, `GlowButton`, `CodeDisplay`, `TerminalReveal`, `StatusIndicator`, `Countdown`
- Produces: 3-panel control room layout; preserves `data-testid`: `notfound`, `deleted`, `creator-code`, `locked-notice`, `notice`, `delete`, `resend-{id}`; keeps `window.confirm()` for E2E dialog compat

- [ ] **Step 1: Rewrite app/manage/[managementToken]/page.tsx entirely**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Countdown } from '@/app/components/Countdown'
import { PageHeader } from '@/app/components/PageHeader'
import { Panel } from '@/app/components/Panel'
import { GlowButton } from '@/app/components/GlowButton'
import { CodeDisplay } from '@/app/components/CodeDisplay'
import { TerminalReveal } from '@/app/components/TerminalReveal'
import { StatusIndicator } from '@/app/components/StatusIndicator'

type Contact = { id: string; name: string; email: string }
type ManageData = {
  title: string | null
  locked: boolean
  lockedUntil: string | null
  creatorCode: string
  unlockToken: string
  contacts: Contact[]
}

export default function ManagePage() {
  const { managementToken } = useParams<{ managementToken: string }>()
  const [data, setData] = useState<ManageData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [resentIds, setResentIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const res = await fetch(`/api/brocodes/manage/${managementToken}`)
    if (res.status === 404) return setNotFound(true)
    setData(await res.json())
  }, [managementToken])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function resend(id: string) {
    const res = await fetch(`/api/brocodes/manage/${managementToken}/resend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ participantId: id }),
    })
    if (res.ok) {
      setResentIds((s) => new Set(s).add(id))
      setTimeout(() => setResentIds((s) => { const n = new Set(s); n.delete(id); return n }), 1500)
    }
    setNotice(res.ok ? 'Email re-sent' : 'Resend failed')
  }

  async function remove() {
    // Keep window.confirm() — E2E test uses page.on('dialog', d => d.accept())
    if (!confirm('Delete this Brocode and its media permanently?')) return
    const res = await fetch(`/api/brocodes/manage/${managementToken}`, { method: 'DELETE' })
    if (res.ok) setDeleted(true)
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (notFound) {
    return (
      <div className="flex flex-col h-screen overflow-hidden" data-testid="notfound">
        <PageHeader title="MISSION CONTROL" right={<StatusIndicator label="NOT FOUND" color="alert" />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-alert)' }}>
            Mission not found.
          </span>
        </div>
      </div>
    )
  }

  if (deleted) {
    return (
      <div className="flex flex-col h-screen overflow-hidden" data-testid="deleted">
        <PageHeader title="MISSION CONTROL" right={<StatusIndicator label="MISSION DELETED" color="alert" />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-phosphor-dim)' }}>
            Mission data purged.
          </span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="MISSION CONTROL" right={<StatusIndicator label="LOADING" color="amber" />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs tracking-widest uppercase animate-pulse" style={{ color: 'var(--color-phosphor-dim)' }}>
            Loading…
          </span>
        </div>
      </div>
    )
  }

  const unlockUrl = `${window.location.origin}/unlock/${data.unlockToken}`

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title={`MISSION CONTROL${data.title ? ` — ${data.title.toUpperCase()}` : ''}`}
        right={
          <StatusIndicator
            label={data.locked ? 'LOCKOUT ACTIVE' : 'OPERATIONAL'}
            color={data.locked ? 'alert' : 'phosphor'}
          />
        }
      />
      <TerminalReveal>
        <div className="flex-1 flex flex-col overflow-auto">
          {/* Lockout banner */}
          <AnimatePresence>
            {data.locked && data.lockedUntil && (
              <motion.div
                data-testid="locked-notice"
                className="px-6 py-3 flex items-center gap-4 border-b shrink-0"
                style={{ background: 'rgba(255,34,34,0.08)', borderColor: 'var(--color-alert)', color: 'var(--color-alert)' }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <span className="text-xs tracking-widest uppercase font-bold">⚠ LOCKOUT ACTIVE</span>
                <Countdown until={data.lockedUntil} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Top two panels */}
          <div
            className="grid grid-cols-2 border-b shrink-0"
            style={{ borderColor: 'var(--color-panel-border)' }}
          >
            <Panel label="YOUR AUTHORIZATION CODE">
              {/* sr-only span for E2E text assertion */}
              <span data-testid="creator-code" className="sr-only">{data.creatorCode}</span>
              <CodeDisplay code={data.creatorCode} />
            </Panel>
            <Panel label="UNLOCK ENDPOINT">
              <div className="space-y-3">
                <p className="text-xs break-all leading-relaxed" style={{ color: 'var(--color-phosphor-dim)' }}>
                  {unlockUrl}
                </p>
                <GlowButton onClick={() => copyLink(unlockUrl)}>
                  {copied ? '✓ COPIED' : '[COPY LINK]'}
                </GlowButton>
              </div>
            </Panel>
          </div>

          {/* Operative roster */}
          <Panel label="OPERATIVE ROSTER" className="flex-1">
            {notice && (
              <p data-testid="notice" className="mb-3 text-xs tracking-widest" style={{ color: 'var(--color-phosphor-dim)' }}>
                {notice}
              </p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs tracking-widest uppercase border-b"
                  style={{ borderColor: 'var(--color-panel-border)', color: 'var(--color-phosphor-dim)' }}
                >
                  <th className="text-left py-2 w-8">#</th>
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-right py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.contacts.map((c, i) => (
                  <tr key={c.id} className="border-b" style={{ borderColor: 'var(--color-panel-border)' }}>
                    <td className="py-2 text-xs" style={{ color: 'var(--color-phosphor-dim)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td className="py-2">{c.name}</td>
                    <td className="py-2 text-xs" style={{ color: 'var(--color-phosphor-dim)' }}>{c.email}</td>
                    <td className="py-2 text-right">
                      <GlowButton onClick={() => resend(c.id)} data-testid={`resend-${c.id}`}>
                        {resentIds.has(c.id) ? '✓ SENT' : '[RESEND AUTHORIZATION]'}
                      </GlowButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Danger zone */}
          <div
            className="m-4 p-4 border shrink-0"
            style={{ borderColor: 'var(--color-alert)' }}
          >
            <div
              className="text-xs tracking-widest uppercase mb-3 font-bold"
              style={{ color: 'var(--color-alert)', textShadow: '0 0 4px var(--color-alert)' }}
            >
              PERMANENT DELETION
            </div>
            <GlowButton color="alert" onClick={remove} data-testid="delete">
              [DELETE BROCODE]
            </GlowButton>
          </div>
        </div>
      </TerminalReveal>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/manage/[managementToken]/page.tsx
git commit -m "feat: rewrite manage page as 3-panel mission control layout"
```

---

### Task 11: Rewrite the View page

**Files:**
- Modify: `app/view/[viewToken]/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `StatusIndicator` from `app/components/`
- Produces: Scan animation + classified frame reveal; preserves `data-testid="relocked"` and `data-testid="asset"`; single-use fetch guard logic unchanged

- [ ] **Step 1: Rewrite app/view/[viewToken]/page.tsx entirely**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/app/components/PageHeader'
import { StatusIndicator } from '@/app/components/StatusIndicator'

type ViewResult = { assetKind: 'image' | 'video'; signedUrl: string }
type Phase = 'scanning' | 'revealed' | 'gone'

export default function ViewPage() {
  const { viewToken } = useParams<{ viewToken: string }>()
  const [result, setResult] = useState<ViewResult | null>(null)
  const [phase, setPhase] = useState<Phase>('scanning')
  // Guard against React StrictMode double-invocation: the view token is single-use,
  // so a second fetch would get 410 and incorrectly show the "Re-locked" screen.
  // We do NOT use an `active` flag here: StrictMode calls the cleanup between the
  // two mounts, which would set active=false and cause the first fetch's result to
  // be discarded (the page would be stuck on "Revealing…").  fetchedRef is the
  // single source of truth — only one fetch ever fires, so stale-state risk is nil.
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetch(`/api/view/${viewToken}`)
      .then(async (res) => {
        if (!res.ok) return setPhase('gone')
        const data = await res.json()
        setResult(data)
        setTimeout(() => setPhase('revealed'), 900)
      })
      .catch(() => setPhase('gone'))
  }, [viewToken])

  if (phase === 'gone') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" data-testid="relocked">
        <PageHeader title="PAYLOAD DECRYPT" right={<StatusIndicator label="ACCESS REVOKED" color="alert" />} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p
            className="text-2xl font-bold tracking-widest uppercase"
            style={{
              color: 'var(--color-phosphor)',
              textShadow: '0 0 4px var(--color-phosphor), 0 0 20px var(--color-phosphor)',
            }}
          >
            PAYLOAD SECURED — ACCESS REVOKED
          </p>
          <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-phosphor-dim)' }}>
            This payload has already been accessed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="PAYLOAD DECRYPT"
        right={
          <StatusIndicator
            label={phase === 'scanning' ? 'DECRYPTING…' : 'PAYLOAD DECRYPTED'}
            color={phase === 'scanning' ? 'amber' : 'phosphor'}
          />
        }
      />
      <div className="relative flex-1 flex flex-col items-center justify-center p-8 overflow-hidden">
        <AnimatePresence>
          {phase === 'scanning' && (
            <>
              <motion.div
                aria-hidden="true"
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  height: '2px',
                  background: 'var(--color-phosphor)',
                  boxShadow: '0 0 24px 8px var(--color-phosphor)',
                  zIndex: 10,
                }}
                initial={{ top: 0 }}
                animate={{ top: '100%' }}
                transition={{ duration: 0.8, ease: 'linear' }}
              />
              <motion.p
                className="text-xl font-bold tracking-widest uppercase"
                style={{
                  color: 'var(--color-phosphor)',
                  textShadow: '0 0 4px var(--color-phosphor), 0 0 20px var(--color-phosphor)',
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                DECRYPTING PAYLOAD…
              </motion.p>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'revealed' && result && (
            <motion.div
              className="w-full max-w-3xl"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              <p
                className="text-xs tracking-widest uppercase mb-3 text-center"
                style={{ color: 'var(--color-phosphor-dim)' }}
              >
                PAYLOAD DECRYPTED — SINGLE-USE ACCESS
              </p>
              {/* Classified frame with corner brackets */}
              <motion.div
                className="relative border p-1"
                style={{ borderColor: 'var(--color-phosphor)' }}
                animate={{
                  boxShadow: [
                    '0 0 16px var(--color-phosphor)',
                    '0 0 4px var(--color-phosphor)',
                  ],
                }}
                transition={{ duration: 1.2, delay: 0.3 }}
              >
                {(['top-0 left-0 border-l-2 border-t-2', 'top-0 right-0 border-r-2 border-t-2', 'bottom-0 left-0 border-l-2 border-b-2', 'bottom-0 right-0 border-r-2 border-b-2'] as const).map(
                  (cls, i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      className={`absolute w-4 h-4 ${cls}`}
                      style={{
                        borderColor: 'var(--color-phosphor)',
                        boxShadow: '0 0 6px var(--color-phosphor)',
                      }}
                    />
                  ),
                )}
                {result.assetKind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    data-testid="asset"
                    src={result.signedUrl}
                    alt="revealed asset"
                    className="w-full block"
                  />
                ) : (
                  <video
                    data-testid="asset"
                    src={result.signedUrl}
                    controls
                    autoPlay
                    className="w-full block"
                  />
                )}
              </motion.div>
              <p
                className="mt-3 text-xs tracking-widest uppercase text-center"
                style={{ color: 'var(--color-phosphor-dim)' }}
              >
                Leaving this page re-locks the asset.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full build**

```bash
pnpm build
```

Expected: build succeeds, zero errors.

- [ ] **Step 4: Commit**

```bash
git add app/view/[viewToken]/page.tsx
git commit -m "feat: rewrite view page with payload decrypt animation and classified frame"
```

---

### Task 12: Final verification

**Files:** none — verification only

- [ ] **Step 1: Run TypeScript check**

```bash
pnpm exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Run unit tests**

```bash
pnpm test run
```

Expected: all existing tests pass (visual components have no unit tests).

- [ ] **Step 3: Start dev server and walk all pages**

```bash
pnpm dev
```

Check each page:

| Page | What to verify |
|------|----------------|
| `/` | Dark background, CRT scanlines, 2-panel layout, hold button fill animation, armed readout after submit |
| `/unlock` | Single panel, terminal input, phosphor focus border |
| `/unlock/[token]` | Station grid, CodeInput digit boxes, detonation flash+shake+type-in on wrong code |
| `/manage/[token]` | 3-panel layout, amber lockout banner if locked, glowing creator code, delete triggers native confirm |
| `/view/[token]` | Scan line sweep, classified frame reveal, PAYLOAD SECURED if revisited |

All pages: Geist Mono throughout, phosphor green on near-black, CRT overlay visible.

- [ ] **Step 4: Confirm data-testid coverage**

| Page | Required data-testid values |
|------|------------------------------|
| `/` | `creator-name`, `title`, `file`, `contact-name-0`, `contact-email-0`, `add-contact`, `submit`, `creator-code`, `manage-link`, `error` |
| `/unlock` | `asset-id`, `go` |
| `/unlock/[token]` | `locked`, `progress`, `participant-{name}`, `code`, `enter` |
| `/manage/[token]` | `notfound`, `deleted`, `creator-code`, `locked-notice`, `notice`, `delete`, `resend-{id}` |
| `/view/[token]` | `relocked`, `asset` |

- [ ] **Step 5: Final commit**

```bash
git add -A
git status  # verify only expected files
git commit -m "chore: nuclear mission control redesign — final verification"
```
