# Mobile-First Design

**Date:** 2026-07-22  
**Scope:** All 5 pages + shared PageHeader component  
**Approach:** Tailwind responsive utilities (`sm:` prefix) applied surgically to broken spots. No new components. No behavior changes.

---

## Problem Summary

The app is desktop-only by accident. Key breakages at mobile viewport (<640px):

| Location | Issue |
|---|---|
| `PageHeader` | Long title + right slot overflow horizontally |
| Create page | `grid-cols-2` hard-codes two columns at all widths |
| Create page | Contact row name+email inputs side-by-side, too narrow |
| Manage page | 5-column table overflows horizontally |
| Unlock ritual | `grid-cols-3` with 5+ participants is too tight; header progress bar overflows |
| View page | `p-8` wastes screen space on mobile |

---

## Changes Per File

### `app/components/PageHeader.tsx`

Add `truncate min-w-0 flex-1 mr-2` to the title `<span>`. Titles truncate rather than pushing the status badge off-screen. No other change.

### `app/page.tsx` (Create)

1. Outer `div`: `h-screen overflow-hidden` → `min-h-screen sm:h-screen sm:overflow-hidden`. Mobile scrolls the full page; desktop keeps the locked-viewport look.
2. Inner `motion.div`: remove `overflow-hidden` (was `flex-1 flex flex-col overflow-hidden` → `flex-1 flex flex-col`). On mobile, content flows to natural height.
3. Grid: `flex-1 grid grid-cols-2 overflow-hidden` → `grid grid-cols-1 sm:flex-1 sm:grid-cols-2 sm:overflow-hidden`. Panels stack on mobile, side-by-side on `sm+`.
4. Both `Panel` `className` props: `overflow-y-auto` → `sm:overflow-y-auto`. On desktop, panels scroll internally. On mobile, the page scrolls.
5. Contact inputs (name and email): `w-1/2` → `flex-1 min-w-0`. Fill available space without overflow.

### `app/manage/[managementToken]/page.tsx`

Replace the contacts `<table>` with two sibling renders that share all existing state (`editEmails`, `resentIds`, `resend`, `saveEmail`):

- **Mobile card list** (`sm:hidden`): one `<div>` per operative. Shows index + name on one line, email (or edit input if bounced/failed) on the next, status badge, then action button full-width. No horizontal scrolling.
- **Desktop table** (`hidden sm:table` on the `<table>` element): the existing 5-column table, unchanged.

The creator email section above the table is already `flex-wrap` — no change needed.

### `app/unlock/[unlockToken]/page.tsx`

1. `gridClass()` function: the `grid-cols-3` return value (5+ participants) becomes `'grid-cols-2 sm:grid-cols-3'`. Cases for 1–4 participants already work on mobile.
2. Header right slot: wrap the animated progress bar `<div>` in `<span className="hidden sm:flex ...">`. The `[X/Y AUTHORIZED]` count text stays visible on all screen sizes.

### `app/view/[viewToken]/page.tsx`

Content area `p-8` → `p-4 sm:p-8`. Gives the media more room on mobile.

### `app/unlock/page.tsx` (Unlock landing)

No changes. Already single-column and centered.

---

## Success Criteria

- [ ] All pages render without horizontal overflow at 375px viewport width
- [ ] Create page: panels stack vertically on mobile, side-by-side on desktop
- [ ] Manage page: operative list readable without horizontal scrolling on mobile
- [ ] Unlock ritual: participant grid uses max 2 columns on mobile; header does not overflow
- [ ] View page: media fills most of the screen on mobile with comfortable padding
- [ ] Desktop layout unchanged on all pages
- [ ] No new components introduced
- [ ] No behavior or state changes
