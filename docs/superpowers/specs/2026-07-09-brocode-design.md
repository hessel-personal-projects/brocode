# Brocode — Design Spec

**Date:** 2026-07-09
**Status:** Approved for planning

## 1. Summary

Brocode is a "two-key nuclear launch" gate for a single media asset. A creator
uploads a small image or video and assigns a set of contacts. Every participant
(the creator plus each contact) receives a private six-digit code. The asset stays
locked and only plays when everyone gathers at one screen and enters their correct
codes, one after another. No single person can unlock it alone.

The metaphor is deliberate: like a missile launch, it takes all key-holders acting
together, and a single mistake has a real cost — one wrong code locks that asset for
24 hours.

## 2. Core Mechanic (agreed decisions)

- **No accounts.** Nobody signs up. Access is via unguessable tokens delivered by
  email and shown once at creation.
- **Email-delivered codes.** The creator enters a name + email per contact; the
  system emails each contact their private six-digit code plus the shared unlock
  link. The creator sees their own code at creation time (not emailed).
- **Shared-screen unlock, one device.** Everyone gathers at a single screen and
  takes turns typing their own six-digit code. No real-time cross-device sync.
- **Any order.** Codes may be entered in any order within the unlock session.
- **Single strike → 24h lockout, scoped to the asset.** One wrong code — from
  anyone — locks *that one media asset* for 24 hours. No retries. Every other
  Brocode in the system is unaffected. The app is never globally locked.
- **Repeatable.** After a successful unlock the asset plays once, then re-locks.
  Viewing again requires the full ritual again. Same codes are reused forever,
  until the creator deletes the Brocode.
- **Unguessable asset ID.** The asset is found via a long, unguessable token
  (the `unlockToken`), delivered in the email link and pasteable manually. This
  prevents strangers from finding and griefing a specific asset via the lockout.

### Two user entry points
1. **Create** — upload media + enter contact emails → contacts are emailed codes;
   creator sees their own code.
2. **Unlock** — a landing page where the user either clicks the emailed link or
   pastes the asset ID to find the (still-locked) media, then enters the codes
   everyone received earlier.

## 3. Assumptions & Constraints

- Web only, responsive (desktop + mobile browsers).
- Accepted media: images (`jpg`, `png`, `gif`, `webp`) and video (`mp4`, `webm`),
  **≤ 5 MB** per file. One asset per Brocode.
- Codes are **6-digit numeric**, generated server-side, stored **encrypted at
  rest** (authenticated symmetric encryption) so they remain recoverable for the
  Manage view and resend actions.
- Contacts per Brocode: **1–10** (MVP cap).
- No Brocode expiry — persists until the creator deletes it.
- After a successful unlock, viewing is a **single reveal**: leaving/closing the
  page re-locks it.

### Timing defaults
- **UnlockSession TTL:** 10 minutes from `startedAt`, then abandoned.
- **View token TTL:** 2 minutes, single-use.
- **Signed R2 URL TTL:** 2 minutes.
- **Lockout duration:** 24 hours from the wrong entry.

## 4. Architecture

- **Next.js (App Router, React, TypeScript)** — full-stack: UI + API routes.
- **Postgres (Neon)** via **Prisma** — metadata, participants, codes, lockout,
  unlock sessions.
- **Cloudflare R2 (S3-compatible)** — media stored in a **private** bucket. Never
  publicly reachable; served only via short-lived signed URLs issued after a
  successful unlock.
- **Resend** — transactional email to contacts.

All security-relevant state and decisions live server-side. The client only
renders server-owned state and is never trusted.

## 5. Data Model

### Brocode
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `managementToken` | string | Secret; creator's only way back in |
| `unlockToken` | string | Shared; goes in emails and is the pasteable asset ID |
| `assetObjectKey` | string | R2 object key |
| `assetContentType` | string | Validated MIME type |
| `assetKind` | enum | `image` \| `video` |
| `title` | string? | Optional |
| `lockedUntil` | timestamp? | Set to `now + 24h` on a wrong entry |
| `createdAt` | timestamp | |

### Participant
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `brocodeId` | uuid | FK → Brocode |
| `role` | enum | `creator` \| `contact` |
| `name` | string | Display name for progress UI |
| `email` | string? | Null for creator (not emailed) |
| `codeEncrypted` | string | AES-256-GCM ciphertext of the 6-digit code (recoverable via server key) |
| `createdAt` | timestamp | |

### UnlockSession
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `brocodeId` | uuid | FK → Brocode |
| `matchedParticipantIds` | json | Participants whose codes have matched this session |
| `startedAt` | timestamp | |
| `expiresAt` | timestamp | Session abandoned/reset after this |

## 6. Flows

### 6.1 Create
1. Creator uploads a file (≤5MB), sets an optional title, adds 1–10 contacts
   (name + email each).
2. Server validates file size and content-type.
3. Server generates one 6-digit code per participant (creator + contacts), hashes
   each, and stores participants.
4. Server uploads media to R2 (private bucket) and creates the Brocode with a
   fresh `managementToken` and `unlockToken`.
5. Server emails each contact their code + the shared unlock link (via Resend).
6. Creator is shown, once, their **management link** and **their own code**.

### 6.2 Manage
Visiting the management link shows:
- Status, including a live countdown if `lockedUntil` is in the future.
- The creator's own code.
- The contact list.
- The shared unlock link / asset ID.
- **Delete** action (removes media from R2 + all records).
- **Resend email** action (re-sends a contact's code + unlock link).

### 6.3 Unlock (state machine)
The server owns all state; the client renders it.

1. **Open** `/unlock/<unlockToken>` (via link or pasted asset ID) → server loads
   the Brocode.
   - If `lockedUntil > now` → **Locked** screen with live countdown. No input.
   - Else → start a fresh `UnlockSession`; show the code-input GUI with
     progress "0 of N keys turned." (N = total participants, creator included.)
2. **Submit a code** (one at a time, POST to server):
   - **Matches an unmatched participant** → add to `matchedParticipantIds`;
     return updated progress.
   - **No match** → **detonate**: set `lockedUntil = now + 24h`, delete the
     session, return the "locked for 24h" screen. Single strike.
3. **All N matched** → server issues a short-lived, single-use **view token**.
4. **Abandoned session** → an `UnlockSession` past `expiresAt` is discarded, and
   progress restarts fresh on the next load. Abandoning carries **no penalty** —
   only a *wrong code* detonates.

### 6.4 View
With the view token, the client fetches a short-lived signed R2 URL and displays
the image / plays the video. The token is single-use and short-lived; leaving the
page re-locks. The next viewing requires the full ritual again.

### 6.5 Delete
Creator deletes via the management link → media removed from R2, all records
removed.

## 7. Security

- **Codes encrypted at rest** (AES-256-GCM, key from a server-side env secret).
  Codes are recoverable (needed for the Manage view and resend) but never stored in
  plaintext. Brute force is defended primarily by the single-strike 24h lockout: one
  wrong guess costs a day, scoped to that asset.
- **Unguessable tokens** — `managementToken`, `unlockToken`, and view tokens are
  long, random, and cryptographically unguessable. Because the asset is only
  findable via `unlockToken`, strangers cannot trigger the lockout on a target
  asset.
- **Private media bucket** — media is never public; only a short-lived signed URL
  is issued after a full unlock, gated by the view token.
- **Server-side enforcement** of lockout, unlock progress, 5MB limit, and
  content-type. The client is never trusted for any gate.
- **Management link is the only creator credential** — shown once. The UI states
  clearly: "lose it and it's gone."

## 8. Testing

- **Unit**: code generation, hashing/verification, lockout timer math.
- **Integration** (state machine): happy path (all codes → view token);
  wrong-code → 24h lockout; attempt-while-locked → rejected; abandoned session →
  clean reset; wrong file type / >5MB → rejected.
- **E2E**: create → email captured → unlock ritual → view; plus the detonation
  path.

## 9. Out of Scope (MVP)

Accounts/login · SMS · real-time cross-device unlock · ordered/sequential codes ·
one-time burn · editing contacts after creation · analytics · Brocode expiry ·
memorable/short asset IDs.
