# Payload UX Improvements — Design Spec

**Date:** 2026-07-20
**Status:** Approved

---

## Overview

Five targeted improvements to the brocode creation and management flow:

1. Label renames across the create page (cosmetic)
2. Creator email field + redirect-on-arm (flow change)
3. Manage page restructure (removes code panel)
4. Creator receives management link via email (new email type)
5. Proactive email bounce detection with inline correction (new webhook + polling)

---

## 1. Label Renames

Three panel/field labels on the create page (`app/page.tsx`):

| Before | After |
|---|---|
| "Mission Parameters" (panel label) | "Payload Parameters" |
| "Operative Callsign" (field label for `creatorName`) | "Operative Name" |
| "Mission Designation" (field label for `title`) | "Payload Name" |

No logic changes. Text-only diff.

---

## 2. Schema Changes

Two changes to the `Participant` model in `prisma/schema.prisma`:

**a) `email` becomes required for all participants**
The creator participant currently stores `email: null`. It will now always have an email. The `Participant.email` column changes from nullable to non-null.

**b) New `emailDeliveryStatus` field**

```prisma
enum EmailDeliveryStatus {
  PENDING
  DELIVERED
  BOUNCED
  FAILED
}

model Participant {
  // ... existing fields ...
  emailDeliveryStatus EmailDeliveryStatus @default(PENDING)
}
```

Set to `PENDING` on creation, updated by the Resend webhook handler.

---

## 3. Creator Email Field + Post-Arm Redirect

### Create form

A new required field "Creator Email" is added directly below "Operative Name" in the "Payload Parameters" panel. This is the email address where the management link is sent.

The `POST /api/brocodes` endpoint already accepts the creator's name. It is extended to accept `creatorEmail` and store it on the creator `Participant` record.

### Post-arm flow

The current success screen (CodeDisplay + "THIS URL IS SHOWN ONCE. SECURE IT NOW." warning) is **removed entirely**. After the API returns `managementToken`, the client redirects straight to `/manage/[managementToken]`.

### Manage page restructure

The "YOUR AUTHORIZATION CODE" panel is removed. The creator sees their code only in their email.

New layout (two panels):

- **Top (full width):** UNLOCK ENDPOINT — the shareable unlock URL with `[COPY LINK]`
- **Bottom (full width):** OPERATIVE ROSTER — operative rows with delivery status (see §5)

The danger zone, lockout banner, and delete confirmation dialog are unchanged.

---

## 4. Email Types

### Creator email (new)

Sent to the creator immediately after arming. Contains:
- Their 6-digit authorization code
- The management link (full URL to `/manage/[managementToken]`)
- The unlock link (full URL to `/unlock/[unlockToken]`) — to share with operatives

A new `CreatorManageEmail` interface is added to `lib/email/types.ts` alongside the existing `ContactCodeEmail`. A new renderer is added to `lib/email/template.ts`.

### Operative email (unchanged)

Still contains: the operative's 6-digit code + the unlock link. No changes to the existing template or sending logic.

---

## 5. Proactive Bounce Detection

### Webhook endpoint

`POST /api/webhooks/resend` — receives delivery events from Resend. Verifies the request using Resend's SVIX-based webhook signature (header `svix-id`, `svix-timestamp`, `svix-signature`) against the `RESEND_WEBHOOK_SECRET` env var.

Handled event types:

| Resend event | Action |
|---|---|
| `email.sent` | No-op (status stays `PENDING`) |
| `email.delivered` | Set `emailDeliveryStatus = DELIVERED` |
| `email.bounced` | Set `emailDeliveryStatus = BOUNCED` |
| `email.failed` | Set `emailDeliveryStatus = FAILED` |

The webhook matches events to participants via Resend's email ID. The `Participant` record stores a `resendEmailId` field (new, nullable string) set when the email is sent and the Resend API returns an ID.

**Schema addition:**

```prisma
model Participant {
  // ... existing fields ...
  resendEmailId       String?
  emailDeliveryStatus EmailDeliveryStatus @default(PENDING)
}
```

### Manage page polling

The manage page polls `GET /api/brocodes/manage/[managementToken]` every 5 seconds. The response already includes all participant data; no new API surface needed. The existing endpoint is extended to return `emailDeliveryStatus` per participant.

Polling stops once all participants reach a terminal status (`DELIVERED`, `BOUNCED`, or `FAILED`).

### Operative roster row states

Each row in the OPERATIVE ROSTER shows a status indicator alongside the operative's name:

| Status | Indicator |
|---|---|
| `PENDING` | Grey dot — "PENDING" |
| `DELIVERED` | Green dot — "DELIVERED" |
| `BOUNCED` | Red indicator — "DELIVERY FAILED" |
| `FAILED` | Red indicator — "DELIVERY FAILED" |

When status is `BOUNCED` or `FAILED`, the row expands to show an inline editable email input pre-filled with the current (wrong) address. Saving calls `PATCH /api/brocodes/manage/[managementToken]/participants/[id]` with the new email, then immediately triggers a resend. The row status resets to `PENDING` while the new attempt is in flight.

### Creator email delivery status

The creator is not in the OPERATIVE ROSTER, but their email can also bounce — and their email contains their 6-digit code, so a bounce means they cannot participate in the unlock ritual. The manage page shows a dedicated "YOUR AUTHORIZATION EMAIL" status row above the OPERATIVE ROSTER, with the same status indicators and inline email editing as operative rows. If the creator's email fails, they can correct their own address and trigger a resend from the manage page.

### New API endpoints

- `POST /api/webhooks/resend` — Resend webhook handler
- `PATCH /api/brocodes/manage/[managementToken]/participants/[id]` — update operative email + trigger resend

---

## Affected Files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `emailDeliveryStatus` enum + field, `resendEmailId` field, make `email` non-null |
| `lib/email/types.ts` | Add `CreatorManageEmail` interface |
| `lib/email/template.ts` | Add creator email renderer |
| `lib/email/resend.ts` | Store returned Resend email ID on participant; send creator email |
| `lib/email/capture.ts` | Handle `CreatorManageEmail` in dev capture service |
| `lib/create.ts` | Accept `creatorEmail`, send creator email, store `resendEmailId` |
| `lib/manage.ts` | Return `emailDeliveryStatus` per participant; add `updateParticipantEmail()` |
| `app/page.tsx` | Label renames, add Creator Email field, remove success screen, redirect on arm |
| `app/manage/[managementToken]/page.tsx` | Remove code panel, add delivery status UI, add inline email edit, add polling |
| `app/api/brocodes/route.ts` | Accept `creatorEmail` in form data |
| `app/api/brocodes/manage/[managementToken]/route.ts` | Return `emailDeliveryStatus` + `resendEmailId` |
| `app/api/brocodes/manage/[managementToken]/participants/[id]/route.ts` | New: PATCH handler |
| `app/api/webhooks/resend/route.ts` | New: webhook handler |
