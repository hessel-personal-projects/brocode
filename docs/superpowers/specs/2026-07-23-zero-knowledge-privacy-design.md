# Zero-Knowledge Privacy Design

**Date:** 2026-07-23
**Scope:** Asset storage + unlock code delivery
**Approach:** Client-side AES-256-GCM encryption for assets; client-side PBKDF2 code generation; blind SMTP relay replacing Resend; AWS SES for delivery with SNS webhooks for status tracking.

---

## 1. Problem

As the app operator you have passive visibility into two classes of user data:

| Location | What's visible |
|---|---|
| Supabase Storage dashboard | Plaintext asset files (images/video) |
| Resend email logs | Plaintext unlock codes sent to contacts |

Goal: eliminate operator visibility without changing any user-facing behaviour.

---

## 2. Architecture Overview

Two independent changes, each deployable separately:

**Asset encryption** — files are encrypted in the browser before upload. The decryption key lives only in the URL fragment, which is never sent in HTTP requests. The server stores ciphertext. The browser decrypts after fetching a signed URL.

**Code privacy** — codes are generated in the browser, hashed with PBKDF2, and only the hash is stored in the DB. Plaintext codes are dispatched via a blind relay endpoint (Nodemailer → AWS SES SMTP) that relays without logging the body. Resend is removed entirely.

### End-to-end creation flow

```
Browser
  1. generateAssetKey()           → 256-bit random key
  2. encryptFile(file, key)       → ciphertext buffer
  3. For each participant: generateCode() → hash via PBKDF2 → { codeHash, codeSalt }
     (plaintext codes held in browser memory only)
  4. POST /api/create             → sends { encryptedFile, participants: [{name, email, role, codeHash, codeSalt}] }
     Server stores ciphertext in Supabase, participants + hashes in DB
     Returns { managementToken, unlockToken, participants: [{ id, email, role }] }
  5. Browser constructs share URLs:
     unlockUrl  = /unlock/[unlockToken]#key=<base64url(key)>
     manageUrl  = /manage/[managementToken]#key=<base64url(key)>
  6. For each participant:
     a. POST /api/dispatch-email  → { to, subject, html, text } (plaintext code in body)
        Server relays via SES SMTP, returns { messageId }
     b. POST /api/participants/[id]/register-message-id → { messageId }
```

### End-to-end view flow

```
Contact visits /unlock/[unlockToken]#key=...
  Enters code → POST /api/unlock/verify → server runs PBKDF2(submitted, salt) == storedHash
  All required codes matched → session complete → server returns viewToken
  Browser navigates to /view/[viewToken]#key=...
    Reads key from window.location.hash
    Fetches encrypted asset via signed URL
    Decrypts: IV = first 12 bytes, ciphertext = remainder, AES-256-GCM
    Renders decrypted bytes as Blob URL
```

---

## 3. Asset Encryption

### Encryption (upload)

In the browser, before sending the file to the server:

```
key  = crypto.getRandomValues(new Uint8Array(32))         // AES-256 key
iv   = crypto.getRandomValues(new Uint8Array(12))         // GCM nonce
ct   = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, importedKey, fileBuffer)
blob = concat(iv, ct)                                     // 12-byte IV prepended
```

The encrypted `blob` is sent to the server as the file buffer. `lib/storage.ts` and `uploadAsset()` are unchanged — they receive a `Buffer` and store it.

### Decryption (view)

```
key     = base64url.decode(window.location.hash.slice('#key='.length))
buffer  = await fetch(signedUrl).then(r => r.arrayBuffer())
iv      = buffer.slice(0, 12)
ct      = buffer.slice(12)
plain   = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, importedKey, ct)
src     = URL.createObjectURL(new Blob([plain], { type: assetContentType }))
```

### Error state

If the URL fragment is absent or malformed, the view page shows:
> "This link is missing the decryption key — make sure you copied the full URL."

### What changes

- New `lib/client/crypto.ts` — `generateAssetKey()`, `encryptFile()`, `decryptAsset()`
- Create page component — calls `encryptFile` before upload, passes ciphertext as file buffer
- View page component — calls `decryptAsset` after signed URL fetch, renders result
- `lib/storage.ts` — **unchanged**
- `lib/create.ts` — asset upload path unchanged; file buffer now arrives pre-encrypted from browser

---

## 4. Code Privacy

### Current state

Codes are stored as `codeEncrypted` (AES-256-GCM, reversible). `lib/crypto.ts` exports `encryptCode` / `decryptCode` / `verifyCode`. The server can recover any plaintext code at any time.

### New state

Codes are generated in the browser, hashed with PBKDF2. Server stores hash + salt only.

### PBKDF2 parameters (must match browser and server exactly)

| Parameter | Value |
|---|---|
| Algorithm | PBKDF2-SHA256 |
| Iterations | 100,000 |
| Key length | 32 bytes |
| Salt | 16 random bytes (per code) |
| Password encoding | UTF-8 |

### Code format

Unchanged: 6-digit numeric (`000000`–`999999`). Existing rate-limiting + lockout makes brute force infeasible. No UX change.

### Browser-side generation

```ts
// lib/client/crypto.ts
export function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return n.toString().padStart(6, '0')
}

export async function hashCode(code: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt, iterations:100_000 }, key, 256)
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}
```

### Server-side verification

```ts
// lib/crypto.ts (server)
import crypto from 'node:crypto'

export function verifyCode(submitted: string, storedHash: string, storedSalt: string): boolean {
  const salt = Buffer.from(storedSalt, 'base64')
  const hash = crypto.pbkdf2Sync(submitted, salt, 100_000, 32, 'sha256').toString('base64')
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash))
}
```

### Resend behaviour change

The original plaintext code is gone after creation. Resending from the manage page always generates a **new code**: browser generates → hashes → updates DB → dispatches email. Semantically identical to current behaviour (contacts always receive a valid current code).

### Key management chain

The asset decryption key is embedded in both the `unlockUrl` and `manageUrl` sent to the creator. The manage page reads the key from its own URL fragment (`/manage/[token]#key=...`) when constructing unlock URLs for resent emails. The creator must retain their original email or the full manage URL to preserve resend capability.

---

## 5. Blind Dispatch Endpoint

`POST /api/dispatch-email`

**Auth:** requires valid management token in `Authorization: Bearer <managementToken>` header.

**Request body:**
```json
{
  "to": "contact@example.com",
  "subject": "Your unlock code",
  "html": "<p>...</p>",
  "text": "..."
}
```

**Behaviour:**
- Validates management token
- Creates Nodemailer transporter (SES SMTP credentials from env)
- Calls `transporter.sendMail()` — body is never logged or stored
- Returns `{ messageId }` from Nodemailer
- On SMTP failure, returns 502 with `{ error: "dispatch failed" }`

The endpoint has no knowledge of what it's sending. It is a relay only.

**What changes:**
- New `app/api/dispatch-email/route.ts`
- `lib/email/resend.ts` — removed
- `lib/email/ses.ts` — new Nodemailer transporter (no `sendMail` calls here; that's the dispatch endpoint's job)
- `lib/email/index.ts` — updated transport routing

---

## 6. AWS SES + Delivery Tracking

### Sending

Nodemailer transport via SES SMTP:

```
host: email-smtp.<region>.amazonaws.com
port: 587
auth: { user: SES_SMTP_USER, pass: SES_SMTP_PASSWORD }
```

New env vars: `SES_SMTP_USER`, `SES_SMTP_PASSWORD`, `SES_FROM_ADDRESS`
Removed env vars: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`

### Delivery tracking

SES Configuration Set → SNS topic → HTTPS subscription → `/api/webhooks/email`

Events subscribed: `send`, `delivery`, `bounce`, `complaint`

The existing `EmailDeliveryStatus` enum (`PENDING`, `DELIVERED`, `BOUNCED`, `FAILED`) is unchanged.

**Webhook handler changes:**
- `app/api/webhooks/resend/route.ts` → `app/api/webhooks/email/route.ts`
- Replace Svix signature verification with SNS signature verification (using AWS SNS SDK or manual HTTPS certificate check)
- Map SES event types to existing `updateDeliveryStatus()` call:

| SES event | Status |
|---|---|
| `Delivery` | `DELIVERED` |
| `Bounce` | `BOUNCED` |
| `Complaint` | `FAILED` |

SNS signature verification uses AWS certificate-based validation (fetch signing cert from message's `SigningCertURL`, verify signature). No pre-shared secret needed.

### messageId storage

`resendEmailId` column renamed to `emailMessageId` in a migration. Stores SES messageId. Semantically identical usage.

---

## 7. Schema Migration

```sql
-- Add new columns
ALTER TABLE "Participant" ADD COLUMN "codeHash" TEXT;
ALTER TABLE "Participant" ADD COLUMN "codeSalt" TEXT;
ALTER TABLE "Participant" RENAME COLUMN "resendEmailId" TO "emailMessageId";

-- Migration script (runs before dropping old column):
-- For each participant: decrypt codeEncrypted → PBKDF2 hash → write codeHash + codeSalt

-- After migration script succeeds:
ALTER TABLE "Participant" DROP COLUMN "codeEncrypted";
ALTER TABLE "Participant" ALTER COLUMN "codeHash" SET NOT NULL;
ALTER TABLE "Participant" ALTER COLUMN "codeSalt" SET NOT NULL;
```

The migration script is a one-time Node script (`scripts/migrate-codes.ts`) that:
1. Fetches all participants with `codeEncrypted`
2. Decrypts each using existing `decryptCode()`
3. Generates a random salt per participant
4. Computes PBKDF2 hash using Node `crypto.pbkdf2Sync`
5. Writes `codeHash` + `codeSalt` to DB
6. Verifies round-trip before dropping `codeEncrypted`

`CODE_ENCRYPTION_KEY` env var is retired after migration.

---

## 8. Files Changed

| File | Change |
|---|---|
| `lib/crypto.ts` | Remove `encryptCode`, `decryptCode`; update `verifyCode` signature to `(submitted, hash, salt)`; keep `generateToken` |
| `lib/client/crypto.ts` | New — `generateAssetKey`, `encryptFile`, `decryptAsset`, `generateCode`, `hashCode` |
| `lib/create.ts` | Accept pre-hashed codes + encrypted asset from client payload; remove server-side `generateCode`, `encryptCode`, email sending |
| `lib/manage.ts` | Resend path: accept new hash + salt from client; remove `decryptCode` calls |
| `lib/storage.ts` | Unchanged |
| `lib/email/resend.ts` | Removed |
| `lib/email/ses.ts` | New — Nodemailer transporter only (no send calls) |
| `lib/email/index.ts` | Update transport routing |
| `app/api/dispatch-email/route.ts` | New — blind relay endpoint |
| `app/api/webhooks/resend/route.ts` | Renamed to `webhooks/email/route.ts`; swap Svix for SNS verification |
| `app/unlock/[unlockToken]/page.tsx` | Read key from URL fragment; pass to view navigation |
| `app/(view)/view/[viewToken]/page.tsx` | Read key from URL fragment; decrypt asset client-side |
| `app/page.tsx` (create) | Generate key + codes in browser; call dispatch endpoint per participant |
| `app/manage/[managementToken]/page.tsx` | Read key from URL fragment; use in resend flow |
| `prisma/schema.prisma` | `codeEncrypted` → `codeHash` + `codeSalt`; `resendEmailId` → `emailMessageId` |
| `scripts/migrate-codes.ts` | New — one-time migration from encrypted to hashed codes |

---

## 9. Out of Scope

- Contact authentication mechanism (remains code-entry at shared screen)
- Unlock session logic (`UnlockSession`, `matchedParticipantIds`) — unchanged
- Email templates — content unchanged, just different transport
- Admin access controls on Supabase or AWS console
