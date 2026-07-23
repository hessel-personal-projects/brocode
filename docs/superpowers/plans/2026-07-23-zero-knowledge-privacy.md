# Zero-Knowledge Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate operator visibility into user assets (Supabase Storage) and unlock codes (email logs) by encrypting assets client-side and generating/hashing codes in the browser.

**Architecture:** Two independent changes: (1) AES-256-GCM encryption of files in the browser before upload, decryption key stored only in the URL fragment; (2) codes generated and PBKDF2-hashed in the browser, server stores hash+salt only, emails dispatched via a blind relay endpoint using AWS SES SMTP. Resend and Svix are removed.

**Tech Stack:** Web Crypto API (browser), Node.js `crypto` module (server), Nodemailer + AWS SES SMTP, Prisma migrations, Vitest, Playwright

## Global Constraints

- PBKDF2 parameters must be identical on browser and server: SHA-256, 100,000 iterations, 32-byte key, UTF-8 password, 16-byte salt
- IV for AES-256-GCM: 12 bytes, prepended to ciphertext in storage
- Code format unchanged: 6-digit numeric string (000000–999999)
- `EMAIL_TRANSPORT=capture` must continue to work in test environments (dispatch endpoint returns a fake messageId without sending)
- Never log email body content in the dispatch endpoint
- All Prisma schema changes go through `prisma migrate dev` — no manual SQL outside migrations
- Test command: `npm test` (Vitest unit tests); E2E: `npm run test:e2e`

---

### Task 1: Schema Migration Phase 1

Add nullable `codeHash`, `codeSalt`, `emailMessageId` columns. Keep `codeEncrypted` and `resendEmailId` until data is migrated.

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Participant` model with new nullable fields `codeHash String?`, `codeSalt String?`, `emailMessageId String?`

- [ ] **Step 1: Edit prisma/schema.prisma — add three nullable fields to Participant**

In `prisma/schema.prisma`, the `Participant` model currently reads:

```prisma
model Participant {
  id                  String              @id @default(uuid())
  brocodeId           String
  brocode             Brocode             @relation(fields: [brocodeId], references: [id], onDelete: Cascade)
  role                Role
  name                String
  email               String
  codeEncrypted       String
  resendEmailId       String?
  emailDeliveryStatus EmailDeliveryStatus @default(PENDING)
  createdAt           DateTime            @default(now())
}
```

Change it to:

```prisma
model Participant {
  id                  String              @id @default(uuid())
  brocodeId           String
  brocode             Brocode             @relation(fields: [brocodeId], references: [id], onDelete: Cascade)
  role                Role
  name                String
  email               String
  codeEncrypted       String
  codeHash            String?
  codeSalt            String?
  resendEmailId       String?
  emailMessageId      String?
  emailDeliveryStatus EmailDeliveryStatus @default(PENDING)
  createdAt           DateTime            @default(now())
}
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add-code-hash-cols
```

Expected: Prisma prints `The following migration(s) have been applied` and the migration file is created under `prisma/migrations/`.

- [ ] **Step 3: Verify the columns exist**

```bash
npx prisma studio
```

Open the `Participant` table and confirm `codeHash`, `codeSalt`, `emailMessageId` columns are present with NULL values.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add code hash and email message id columns (nullable)"
```

---

### Task 2: Data Migration Script

Decrypt all existing codes using the server key, hash them with PBKDF2, and write to the new columns. Also copy `resendEmailId` → `emailMessageId`.

**Files:**
- Create: `scripts/migrate-codes.ts`

**Interfaces:**
- Consumes: `Participant.codeEncrypted` (existing), `Participant.resendEmailId` (existing), `lib/crypto.ts` exports `decryptCode`, `generateToken`
- Produces: All `Participant` rows have populated `codeHash`, `codeSalt`, `emailMessageId`

- [ ] **Step 1: Create scripts/migrate-codes.ts**

```typescript
import 'dotenv/config'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { decryptCode } from '../lib/crypto'

const prisma = new PrismaClient()

async function hashCode(plaintext: string): Promise<{ codeHash: string; codeSalt: string }> {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(plaintext, salt, 100_000, 32, 'sha256')
  return { codeHash: hash.toString('base64'), codeSalt: salt.toString('base64') }
}

async function main() {
  const participants = await prisma.participant.findMany({
    where: { codeHash: null },
  })
  console.log(`Migrating ${participants.length} participants…`)

  for (const p of participants) {
    const plaintext = decryptCode(p.codeEncrypted)
    const { codeHash, codeSalt } = await hashCode(plaintext)

    // verify round-trip before writing
    const verify = crypto.pbkdf2Sync(plaintext, Buffer.from(codeSalt, 'base64'), 100_000, 32, 'sha256').toString('base64')
    if (!crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(verify))) {
      throw new Error(`Hash verification failed for participant ${p.id}`)
    }

    await prisma.participant.update({
      where: { id: p.id },
      data: {
        codeHash,
        codeSalt,
        emailMessageId: p.resendEmailId ?? null,
      },
    })
    console.log(`  ✓ ${p.id}`)
  }
  console.log('Migration complete.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run the migration script**

```bash
npx tsx scripts/migrate-codes.ts
```

Expected output: `Migrating N participants…` followed by one `✓ <id>` per participant, ending with `Migration complete.`

- [ ] **Step 3: Verify all rows are populated**

```bash
npx prisma studio
```

Open `Participant` table. Confirm every row has non-null `codeHash` and `codeSalt`.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-codes.ts
git commit -m "feat: add code migration script (encrypted → PBKDF2 hash)"
```

---

### Task 3: Schema Migration Phase 2

Drop `codeEncrypted` and `resendEmailId`, make `codeHash`/`codeSalt` NOT NULL. Update `updateDeliveryStatus` to use `emailMessageId`.

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/manage.ts` (updateDeliveryStatus query field)

**Interfaces:**
- Consumes: All `Participant` rows have `codeHash`, `codeSalt` populated (Task 2 complete)
- Produces: `Participant` model with `codeHash String`, `codeSalt String`, `emailMessageId String?`; no `codeEncrypted`, no `resendEmailId`

- [ ] **Step 1: Edit prisma/schema.prisma — finalize Participant model**

Replace the `Participant` model with:

```prisma
model Participant {
  id                  String              @id @default(uuid())
  brocodeId           String
  brocode             Brocode             @relation(fields: [brocodeId], references: [id], onDelete: Cascade)
  role                Role
  name                String
  email               String
  codeHash            String
  codeSalt            String
  emailMessageId      String?
  emailDeliveryStatus EmailDeliveryStatus @default(PENDING)
  createdAt           DateTime            @default(now())
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name finalize-code-hash
```

If Prisma asks about dropping columns, confirm. Expected: migration applied successfully.

- [ ] **Step 3: Update updateDeliveryStatus in lib/manage.ts**

Find `updateDeliveryStatus` in `lib/manage.ts`. Change the Prisma query from `resendEmailId` to `emailMessageId`:

```typescript
export async function updateDeliveryStatus(
  emailMessageId: string,
  status: EmailDeliveryStatus,
): Promise<void> {
  await prisma.participant.updateMany({
    where: { emailMessageId },
    data: { emailDeliveryStatus: status },
  })
}
```

- [ ] **Step 4: Run tests to confirm no regressions**

```bash
npm test
```

Expected: tests pass (some tests that seed with `codeEncrypted` will fail — that's expected and will be fixed in Task 4).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ lib/manage.ts
git commit -m "feat: finalize schema — drop codeEncrypted, make code hash required"
```

---

### Task 4: Server Crypto Refactor

Replace `encryptCode`/`decryptCode`/`verifyCode` with PBKDF2-based `verifyCode`. Update `lib/unlock.ts` and all test seeds that use `codeEncrypted`.

**Files:**
- Modify: `lib/crypto.ts`
- Modify: `lib/crypto.test.ts`
- Modify: `lib/unlock.ts`
- Modify: `lib/unlock.submit.test.ts`
- Modify: `lib/manage.test.ts`

**Interfaces:**
- Consumes: `Participant.codeHash String`, `Participant.codeSalt String` (from Task 3)
- Produces: `verifyCode(submitted: string, storedHash: string, storedSalt: string): boolean`, `generateToken(bytes?: number): string`

- [ ] **Step 1: Rewrite lib/crypto.ts**

Replace the entire file content:

```typescript
import crypto from 'node:crypto'

export function verifyCode(submitted: string, storedHash: string, storedSalt: string): boolean {
  const salt = Buffer.from(storedSalt, 'base64')
  const hash = crypto.pbkdf2Sync(submitted, salt, 100_000, 32, 'sha256').toString('base64')
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash))
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}
```

- [ ] **Step 2: Write the failing tests for lib/crypto.test.ts**

Replace the entire file:

```typescript
import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import { verifyCode, generateToken } from './crypto'

function makeHash(code: string): { codeHash: string; codeSalt: string } {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(code, salt, 100_000, 32, 'sha256')
  return { codeHash: hash.toString('base64'), codeSalt: salt.toString('base64') }
}

describe('verifyCode', () => {
  it('accepts the correct code', () => {
    const { codeHash, codeSalt } = makeHash('654321')
    expect(verifyCode('654321', codeHash, codeSalt)).toBe(true)
  })

  it('rejects a wrong code', () => {
    const { codeHash, codeSalt } = makeHash('654321')
    expect(verifyCode('000000', codeHash, codeSalt)).toBe(false)
  })

  it('rejects tampered hash', () => {
    const { codeHash, codeSalt } = makeHash('654321')
    const tampered = 'A'.repeat(codeHash.length)
    expect(verifyCode('654321', tampered, codeSalt)).toBe(false)
  })
})

describe('generateToken', () => {
  it('is url-safe and unique', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(20)
  })
})
```

- [ ] **Step 3: Run tests to verify crypto.test.ts passes**

```bash
npm test -- lib/crypto.test.ts
```

Expected: PASS

- [ ] **Step 4: Update lib/unlock.ts — use codeHash/codeSalt**

In `lib/unlock.ts`, line 82, change:

```typescript
const hit = unmatched.find((p) => verifyCode(code, p.codeEncrypted))
```

to:

```typescript
const hit = unmatched.find((p) => verifyCode(code, p.codeHash, p.codeSalt))
```

- [ ] **Step 5: Add a test helper for seeding with hashed codes**

Create `tests/helpers/seed.ts`:

```typescript
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/crypto'

export function makeCodeHash(code: string): { codeHash: string; codeSalt: string } {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(code, salt, 100_000, 32, 'sha256')
  return { codeHash: hash.toString('base64'), codeSalt: salt.toString('base64') }
}

export function seedParticipant(code: string, overrides: Record<string, unknown> = {}) {
  return { ...makeCodeHash(code), ...overrides }
}
```

- [ ] **Step 6: Update lib/unlock.submit.test.ts seed function**

Replace the `seed` function (currently uses `encryptCode`):

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { loadUnlockState, submitCode } from './unlock'
import { prisma } from '@/lib/prisma'
import { resetDb } from '@/tests/helpers/db'
import { makeCodeHash } from '@/tests/helpers/seed'
import { generateToken } from './crypto'
import { LOCKOUT_MS } from './constants'

// codes: Alice 111111, Bob 222222, Cara 333333
async function seed() {
  return prisma.brocode.create({
    data: {
      managementToken: generateToken(),
      unlockToken: generateToken(),
      assetObjectKey: 'assets/x.png',
      assetContentType: 'image/png',
      assetKind: 'image',
      participants: {
        create: [
          { role: 'creator', name: 'Alice', email: 'alice@example.com', ...makeCodeHash('111111') },
          { role: 'contact', name: 'Bob', email: 'b@x.com', ...makeCodeHash('222222') },
          { role: 'contact', name: 'Cara', email: 'c@x.com', ...makeCodeHash('333333') },
        ],
      },
    },
  })
}
```

Keep all existing test bodies — only `seed()` changes. The test assertions remain identical.

- [ ] **Step 7: Update lib/manage.test.ts seed function**

Replace the `seed` function (currently uses `encryptCode`):

```typescript
import { makeCodeHash } from '@/tests/helpers/seed'

async function seed() {
  const key = objectKeyFor('png')
  await uploadAsset(key, png, 'image/png')
  return prisma.brocode.create({
    data: {
      managementToken: generateToken(),
      unlockToken: generateToken(),
      assetObjectKey: key,
      assetContentType: 'image/png',
      assetKind: 'image',
      title: 'Secret',
      participants: {
        create: [
          { role: 'creator', name: 'Alice', email: 'alice@example.com', ...makeCodeHash('111111') },
          { role: 'contact', name: 'Bob', email: 'bob@x.com', ...makeCodeHash('222222') },
        ],
      },
    },
    include: { participants: true },
  })
}
```

Also remove the `encryptCode` import from the top of `lib/manage.test.ts`.

The `resendContactEmail` test (`it('re-sends a contact code + unlock link'…)`) will no longer work because `resendContactEmail` will be removed from `lib/manage.ts` in Task 9. Delete that test block now and replace with a placeholder comment:

```typescript
// resendContactEmail removed — email dispatch is now client-driven (see Task 9)
```

- [ ] **Step 8: Run all tests**

```bash
npm test
```

Expected: all tests pass (webhooks.test.ts may still fail due to `codeEncrypted` in seed — fix that too: the webhook tests create a brocode via `createBrocode()`, which will be refactored in Task 8. For now, if it fails, note it as a known pending fix).

- [ ] **Step 9: Commit**

```bash
git add lib/crypto.ts lib/crypto.test.ts lib/unlock.ts lib/unlock.submit.test.ts lib/manage.test.ts tests/helpers/seed.ts
git commit -m "feat: replace symmetric code encryption with PBKDF2 hashing"
```

---

### Task 5: Client Crypto Utilities

Create the browser-side crypto library used by the create, manage, and view pages.

**Files:**
- Create: `lib/client/crypto.ts`
- Create: `lib/client/crypto.test.ts`

**Interfaces:**
- Produces:
  - `generateAssetKey(): Uint8Array`
  - `keyToFragment(key: Uint8Array): string` — encodes key as base64url for URL fragment
  - `fragmentToKey(fragment: string): Uint8Array` — decodes key from fragment
  - `encryptFile(file: File): Promise<{ ciphertext: Uint8Array; key: Uint8Array }>`
  - `decryptAsset(buffer: ArrayBuffer, key: Uint8Array): Promise<ArrayBuffer>`
  - `generateCode(): string` — 6-digit numeric
  - `generateSalt(): Uint8Array` — 16 random bytes
  - `hashCode(code: string, salt: Uint8Array): Promise<string>` — PBKDF2-SHA256, returns base64
  - `saltToBase64(salt: Uint8Array): string`

- [ ] **Step 1: Create lib/client/crypto.ts**

```typescript
export function generateAssetKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

export function keyToFragment(key: Uint8Array): string {
  return btoa(String.fromCharCode(...key))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export function fragmentToKey(fragment: string): Uint8Array {
  const padded = fragment + '='.repeat((4 - (fragment.length % 4)) % 4)
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export async function encryptFile(
  file: File,
): Promise<{ ciphertext: Uint8Array; key: Uint8Array }> {
  const key = generateAssetKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const keyObj = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, await file.arrayBuffer())
  const ciphertext = new Uint8Array(12 + ct.byteLength)
  ciphertext.set(iv, 0)
  ciphertext.set(new Uint8Array(ct), 12)
  return { ciphertext, key }
}

export async function decryptAsset(
  buffer: ArrayBuffer,
  key: Uint8Array,
): Promise<ArrayBuffer> {
  const iv = buffer.slice(0, 12)
  const ct = buffer.slice(12)
  const keyObj = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt'])
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyObj, ct)
}

export function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return n.toString().padStart(6, '0')
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

export function saltToBase64(salt: Uint8Array): string {
  return btoa(String.fromCharCode(...salt))
}

export async function hashCode(code: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial,
    256,
  )
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}
```

- [ ] **Step 2: Write failing tests for lib/client/crypto.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import {
  generateAssetKey,
  keyToFragment,
  fragmentToKey,
  encryptFile,
  decryptAsset,
  generateCode,
  generateSalt,
  saltToBase64,
  hashCode,
} from './crypto'
import crypto from 'node:crypto'

describe('asset key round-trip', () => {
  it('encodes and decodes key from fragment', () => {
    const key = generateAssetKey()
    const fragment = keyToFragment(key)
    const decoded = fragmentToKey(fragment)
    expect(decoded).toEqual(key)
  })

  it('generates different keys each call', () => {
    expect(keyToFragment(generateAssetKey())).not.toBe(keyToFragment(generateAssetKey()))
  })
})

describe('file encryption round-trip', () => {
  it('decrypts to original bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const file = new File([bytes], 'test.bin')
    const { ciphertext, key } = await encryptFile(file)
    const plain = await decryptAsset(ciphertext.buffer, key)
    expect(new Uint8Array(plain)).toEqual(bytes)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'test.bin')
    const { ciphertext: a } = await encryptFile(file)
    const { ciphertext: b } = await encryptFile(file)
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(b).toString('hex'))
  })

  it('ciphertext starts with 12-byte IV', async () => {
    const file = new File([new Uint8Array([0])], 'test.bin')
    const { ciphertext } = await encryptFile(file)
    expect(ciphertext.length).toBeGreaterThan(12)
  })
})

describe('generateCode', () => {
  it('is always 6 numeric digits', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/)
    }
  })
})

describe('hashCode', () => {
  it('produces consistent output for same input', async () => {
    const salt = generateSalt()
    const a = await hashCode('123456', salt)
    const b = await hashCode('123456', salt)
    expect(a).toBe(b)
  })

  it('matches Node pbkdf2Sync with same parameters', async () => {
    const salt = generateSalt()
    const browserHash = await hashCode('654321', salt)
    const nodeHash = crypto
      .pbkdf2Sync('654321', salt, 100_000, 32, 'sha256')
      .toString('base64')
    expect(browserHash).toBe(nodeHash)
  })

  it('different codes produce different hashes', async () => {
    const salt = generateSalt()
    const a = await hashCode('111111', salt)
    const b = await hashCode('222222', salt)
    expect(a).not.toBe(b)
  })
})

describe('saltToBase64', () => {
  it('round-trips through Buffer.from', () => {
    const salt = generateSalt()
    const b64 = saltToBase64(salt)
    const restored = Buffer.from(b64, 'base64')
    expect(new Uint8Array(restored)).toEqual(salt)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- lib/client/crypto.test.ts
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add lib/client/crypto.ts lib/client/crypto.test.ts
git commit -m "feat: add client-side crypto utilities (AES-GCM + PBKDF2)"
```

---

### Task 6: SES Transport + Dispatch Endpoint

Wire up Nodemailer → AWS SES SMTP. Create the blind dispatch endpoint and the message-id registration endpoint.

**Files:**
- Run: `npm install nodemailer && npm install -D @types/nodemailer`
- Create: `lib/email/ses.ts`
- Create: `app/api/dispatch-email/route.ts`
- Create: `app/api/brocodes/manage/[managementToken]/participants/[id]/message-id/route.ts`
- Modify: `lib/manage.ts` — add `registerMessageId`
- Create: `tests/dispatch-email.test.ts`

**Interfaces:**
- Consumes: `prisma.brocode.findUnique({ where: { managementToken } })` for auth
- Produces:
  - `POST /api/dispatch-email` → `{ messageId: string }` or `{ error }` 502
  - `POST /api/brocodes/manage/[token]/participants/[id]/message-id` → `{ ok: true }` or 404
  - `registerMessageId(managementToken, participantId, messageId): Promise<boolean>` in `lib/manage.ts`

- [ ] **Step 1: Install nodemailer**

```bash
npm install nodemailer && npm install -D @types/nodemailer
```

Expected: packages added to `package.json`.

- [ ] **Step 2: Create lib/email/ses.ts**

```typescript
import nodemailer from 'nodemailer'

export function createSesTransporter() {
  return nodemailer.createTransport({
    host: `email-smtp.${process.env.SES_REGION ?? 'us-east-1'}.amazonaws.com`,
    port: 587,
    secure: false,
    auth: {
      user: process.env.SES_SMTP_USER!,
      pass: process.env.SES_SMTP_PASSWORD!,
    },
  })
}
```

- [ ] **Step 3: Create app/api/dispatch-email/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSesTransporter } from '@/lib/email/ses'

interface DispatchBody {
  to: string
  subject: string
  html: string
  text?: string
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const brocode = await prisma.brocode.findUnique({ where: { managementToken: token } })
  if (!brocode) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: DispatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.to || !body.subject || !body.html) {
    return NextResponse.json({ error: 'to, subject, html required' }, { status: 400 })
  }

  // Capture mode for development/testing — never logs body
  if (process.env.EMAIL_TRANSPORT === 'capture') {
    const id = `capture-${Date.now()}-${Math.random().toString(36).slice(2)}`
    return NextResponse.json({ messageId: id })
  }

  try {
    const transporter = createSesTransporter()
    const info = await transporter.sendMail({
      from: process.env.SES_FROM_ADDRESS!,
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
    })
    // Strip angle brackets from Nodemailer's messageId to match SES event format
    const messageId = (info.messageId as string).replace(/^<|>$/g, '')
    return NextResponse.json({ messageId })
  } catch {
    return NextResponse.json({ error: 'dispatch failed' }, { status: 502 })
  }
}
```

- [ ] **Step 4: Add registerMessageId to lib/manage.ts**

Add this function to `lib/manage.ts` (after the existing `updateDeliveryStatus`):

```typescript
export async function registerMessageId(
  managementToken: string,
  participantId: string,
  messageId: string,
): Promise<boolean> {
  const brocode = await prisma.brocode.findUnique({ where: { managementToken } })
  if (!brocode) return false
  const result = await prisma.participant.updateMany({
    where: { id: participantId, brocodeId: brocode.id },
    data: { emailMessageId: messageId, emailDeliveryStatus: 'PENDING' },
  })
  return result.count > 0
}
```

Also add `updateCodeHash` to `lib/manage.ts` (needed by Task 9):

```typescript
export async function updateCodeHash(
  managementToken: string,
  participantId: string,
  codeHash: string,
  codeSalt: string,
): Promise<boolean> {
  const brocode = await prisma.brocode.findUnique({ where: { managementToken } })
  if (!brocode) return false
  const result = await prisma.participant.updateMany({
    where: { id: participantId, brocodeId: brocode.id },
    data: { codeHash, codeSalt },
  })
  return result.count > 0
}
```

- [ ] **Step 5: Create the message-id registration route**

Create `app/api/brocodes/manage/[managementToken]/participants/[id]/message-id/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { registerMessageId } from '@/lib/manage'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ managementToken: string; id: string }> },
) {
  const { managementToken, id } = await params
  const body = await req.json().catch(() => ({}))
  const messageId = String(body.messageId ?? '').trim()
  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 })
  const ok = await registerMessageId(managementToken, id, messageId)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Write failing tests for the dispatch endpoint**

Create `tests/dispatch-email.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetDb } from './helpers/db'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/crypto'
import { makeCodeHash } from './helpers/seed'
import { POST } from '@/app/api/dispatch-email/route'

async function seedBrocode() {
  return prisma.brocode.create({
    data: {
      managementToken: generateToken(),
      unlockToken: generateToken(),
      assetObjectKey: 'assets/x.png',
      assetContentType: 'image/png',
      assetKind: 'image',
      participants: {
        create: [{ role: 'creator', name: 'Alice', email: 'a@x.com', ...makeCodeHash('111111') }],
      },
    },
  })
}

function makeReq(token: string, body: object) {
  return new Request('http://localhost/api/dispatch-email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/dispatch-email', () => {
  beforeEach(async () => {
    vi.stubEnv('EMAIL_TRANSPORT', 'capture')
    await resetDb()
  })

  it('returns 401 with no auth header', async () => {
    const res = await POST(
      new Request('http://localhost/api/dispatch-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'x@x.com', subject: 'hi', html: '<p>hi</p>' }),
      }) as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 for an unknown management token', async () => {
    const res = await POST(makeReq('bad-token', { to: 'x@x.com', subject: 'hi', html: '<p>hi</p>' }) as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    const b = await seedBrocode()
    const res = await POST(makeReq(b.managementToken, { to: 'x@x.com' }) as any)
    expect(res.status).toBe(400)
  })

  it('returns messageId in capture mode without sending', async () => {
    const b = await seedBrocode()
    const res = await POST(
      makeReq(b.managementToken, {
        to: 'bob@x.com',
        subject: 'Your code',
        html: '<p>code: 123456</p>',
      }) as any,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messageId).toBeTruthy()
    expect(typeof body.messageId).toBe('string')
  })
})
```

- [ ] **Step 7: Run tests**

```bash
npm test -- tests/dispatch-email.test.ts
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add lib/email/ses.ts app/api/dispatch-email/route.ts \
  "app/api/brocodes/manage/[managementToken]/participants/[id]/message-id/route.ts" \
  lib/manage.ts tests/dispatch-email.test.ts package.json package-lock.json
git commit -m "feat: add SES transport, blind dispatch endpoint, message-id registration"
```

---

### Task 7: SNS Webhook Handler

Replace the Resend/Svix webhook with an AWS SNS handler that maps SES delivery events to `updateDeliveryStatus`.

**Files:**
- Create: `app/api/webhooks/email/route.ts`
- Modify: `tests/webhooks.test.ts` — update to test new handler
- Keep: `app/api/webhooks/resend/route.ts` — delete it in Task 12 cleanup

**Interfaces:**
- Consumes: `updateDeliveryStatus(emailMessageId, status)` from `lib/manage.ts`
- Produces: `POST /api/webhooks/email` — handles SNS SubscriptionConfirmation + Notification events

- [ ] **Step 1: Create app/api/webhooks/email/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import https from 'node:https'
import crypto from 'node:crypto'
import { updateDeliveryStatus } from '@/lib/manage'
import type { EmailDeliveryStatus } from '@/lib/email/types'

const STATUS_MAP: Partial<Record<string, EmailDeliveryStatus>> = {
  Delivery: 'DELIVERED',
  Bounce: 'BOUNCED',
  Complaint: 'FAILED',
}

function fetchCert(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

function buildSigningString(msg: Record<string, string>): string {
  const fields =
    msg.Type === 'Notification'
      ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
      : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
  return fields
    .filter((k) => msg[k] !== undefined)
    .map((k) => `${k}\n${msg[k]}\n`)
    .join('')
}

async function verifySns(msg: Record<string, string>): Promise<boolean> {
  const certUrl = msg.SigningCertURL ?? ''
  if (!certUrl.match(/^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\/.*\.pem$/)) return false
  const cert = await fetchCert(certUrl)
  const verify = crypto.createVerify('SHA1withRSA')
  verify.update(buildSigningString(msg))
  return verify.verify(cert, msg.Signature, 'base64')
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  let msg: Record<string, string>
  try {
    msg = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Skip signature verification in test environment
  if (process.env.NODE_ENV !== 'test') {
    const valid = await verifySns(msg).catch(() => false)
    if (!valid) return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  // Auto-confirm SNS subscription
  if (msg.Type === 'SubscriptionConfirmation' && msg.SubscribeURL) {
    await fetch(msg.SubscribeURL).catch(() => null)
    return NextResponse.json({ ok: true })
  }

  if (msg.Type !== 'Notification') return NextResponse.json({ ok: true })

  let event: { notificationType: string; mail: { messageId: string } }
  try {
    event = JSON.parse(msg.Message)
  } catch {
    return NextResponse.json({ ok: true })
  }

  const status = STATUS_MAP[event.notificationType]
  if (status && event.mail?.messageId) {
    await updateDeliveryStatus(event.mail.messageId, status)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Write failing tests**

Create `tests/sns-webhook.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { resetDb } from './helpers/db'
import { generateToken } from '@/lib/crypto'
import { makeCodeHash } from './helpers/seed'
import { POST } from '@/app/api/webhooks/email/route'

vi.stubEnv('NODE_ENV', 'test') // skip SNS signature verification

const TINY_PNG = fs.readFileSync(path.join(__dirname, '../e2e/fixtures/tiny.png'))

async function seedWithMessageId(messageId: string) {
  const brocode = await prisma.brocode.create({
    data: {
      managementToken: generateToken(),
      unlockToken: generateToken(),
      assetObjectKey: 'assets/x.png',
      assetContentType: 'image/png',
      assetKind: 'image',
      participants: {
        create: [{ role: 'creator', name: 'Alice', email: 'a@x.com', ...makeCodeHash('111111'), emailMessageId: messageId }],
      },
    },
    include: { participants: true },
  })
  return brocode.participants[0]
}

function snsNotification(notificationType: string, messageId: string) {
  return new Request('http://localhost/api/webhooks/email', {
    method: 'POST',
    body: JSON.stringify({
      Type: 'Notification',
      MessageId: 'sns-msg-1',
      TopicArn: 'arn:aws:sns:us-east-1:123:topic',
      Message: JSON.stringify({ notificationType, mail: { messageId } }),
      Timestamp: '2026-01-01T00:00:00Z',
      Signature: 'fake',
      SigningCertURL: 'https://sns.us-east-1.amazonaws.com/cert.pem',
    }),
  })
}

describe('POST /api/webhooks/email', () => {
  beforeEach(resetDb)

  it('returns 400 for invalid json', async () => {
    const res = await POST(
      new Request('http://localhost/api/webhooks/email', { method: 'POST', body: 'not-json' }) as any,
    )
    expect(res.status).toBe(400)
  })

  it('updates delivery status to DELIVERED on Delivery event', async () => {
    const participant = await seedWithMessageId('ses-msg-abc')
    const res = await POST(snsNotification('Delivery', 'ses-msg-abc') as any)
    expect(res.status).toBe(200)
    const updated = await prisma.participant.findUnique({ where: { id: participant.id } })
    expect(updated?.emailDeliveryStatus).toBe('DELIVERED')
  })

  it('updates delivery status to BOUNCED on Bounce event', async () => {
    const participant = await seedWithMessageId('ses-msg-bounce')
    await POST(snsNotification('Bounce', 'ses-msg-bounce') as any)
    const updated = await prisma.participant.findUnique({ where: { id: participant.id } })
    expect(updated?.emailDeliveryStatus).toBe('BOUNCED')
  })

  it('ignores unknown event types', async () => {
    const participant = await seedWithMessageId('ses-msg-open')
    await POST(snsNotification('Open', 'ses-msg-open') as any)
    const updated = await prisma.participant.findUnique({ where: { id: participant.id } })
    expect(updated?.emailDeliveryStatus).toBe('PENDING')
  })

  it('auto-confirms SubscriptionConfirmation (returns 200)', async () => {
    const res = await POST(
      new Request('http://localhost/api/webhooks/email', {
        method: 'POST',
        body: JSON.stringify({
          Type: 'SubscriptionConfirmation',
          SubscribeURL: 'https://example.com/confirm',
          Message: '',
          MessageId: 'x',
          Timestamp: '',
          TopicArn: 'arn:x',
          Token: 'tok',
          Signature: 'x',
          SigningCertURL: 'https://sns.us-east-1.amazonaws.com/cert.pem',
        }),
      }) as any,
    )
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/sns-webhook.test.ts
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/email/route.ts tests/sns-webhook.test.ts
git commit -m "feat: add SNS webhook handler for SES delivery tracking"
```

---

### Task 8: Create API Refactor

Accept pre-hashed codes and encrypted file from the client. Remove server-side `generateCode`, `encryptCode`, and email sending from `lib/create.ts`.

**Files:**
- Modify: `lib/create.ts`
- Modify: `app/api/brocodes/route.ts`
- Modify: `lib/create.test.ts`
- Modify: `tests/webhooks.test.ts` (update seed)

**Interfaces:**
- Consumes: `Participant.codeHash String`, `Participant.codeSalt String` (Task 3)
- Produces:
  - `createBrocode(input: CreateInput): Promise<{ managementToken: string; unlockToken: string; participants: { id: string; email: string; role: string }[] }>`
  - `POST /api/brocodes` returns `{ managementToken, unlockToken, participants }`

- [ ] **Step 1: Rewrite lib/create.ts**

```typescript
import { prisma } from './prisma'
import { generateToken } from './crypto'
import { assetInfoFor, objectKeyFor, MAX_FILE_BYTES, createSchema } from './validation'
import { uploadAsset } from './storage'
import { z } from 'zod'

export class ValidationError extends Error {
  status = 400
}

const participantSchema = z.object({
  name: z.string().trim().min(1, 'name required'),
  email: z.email('invalid email'),
  codeHash: z.string().min(1, 'codeHash required'),
  codeSalt: z.string().min(1, 'codeSalt required'),
})

export const createInputSchema = z.object({
  creatorName: z.string().trim().min(1, 'creator name required'),
  creatorEmail: z.email('invalid creator email'),
  creatorCodeHash: z.string().min(1, 'creatorCodeHash required'),
  creatorCodeSalt: z.string().min(1, 'creatorCodeSalt required'),
  title: z.string().trim().max(200).optional(),
  contacts: z.array(participantSchema).min(1, 'at least 1 contact').max(10, 'at most 10 contacts'),
})

export interface CreateInput {
  creatorName: string
  creatorEmail: string
  creatorCodeHash: string
  creatorCodeSalt: string
  title?: string
  contacts: { name: string; email: string; codeHash: string; codeSalt: string }[]
  file: { buffer: Buffer; contentType: string; size: number }
}

export interface CreateResult {
  managementToken: string
  unlockToken: string
  participants: { id: string; email: string; role: string }[]
}

export async function createBrocode(input: CreateInput): Promise<CreateResult> {
  const parsed = createInputSchema.safeParse({
    creatorName: input.creatorName,
    creatorEmail: input.creatorEmail,
    creatorCodeHash: input.creatorCodeHash,
    creatorCodeSalt: input.creatorCodeSalt,
    title: input.title,
    contacts: input.contacts,
  })
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)

  if (input.file.size > MAX_FILE_BYTES) throw new ValidationError('file exceeds 5MB')
  const assetInfo = assetInfoFor(input.file.contentType)
  if (!assetInfo) throw new ValidationError('unsupported file type')

  const managementToken = generateToken()
  const unlockToken = generateToken()
  const objectKey = objectKeyFor(assetInfo.ext)

  await uploadAsset(objectKey, input.file.buffer, input.file.contentType)

  const brocode = await prisma.brocode.create({
    data: {
      managementToken,
      unlockToken,
      assetObjectKey: objectKey,
      assetContentType: input.file.contentType,
      assetKind: assetInfo.kind,
      title: parsed.data.title ?? null,
      participants: {
        create: [
          {
            role: 'creator',
            name: parsed.data.creatorName,
            email: parsed.data.creatorEmail,
            codeHash: parsed.data.creatorCodeHash,
            codeSalt: parsed.data.creatorCodeSalt,
          },
          ...parsed.data.contacts.map((c) => ({
            role: 'contact' as const,
            name: c.name,
            email: c.email,
            codeHash: c.codeHash,
            codeSalt: c.codeSalt,
          })),
        ],
      },
    },
    include: { participants: true },
  })

  return {
    managementToken,
    unlockToken,
    participants: brocode.participants.map((p) => ({ id: p.id, email: p.email, role: p.role })),
  }
}
```

- [ ] **Step 2: Rewrite app/api/brocodes/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createBrocode, ValidationError } from '@/lib/create'
import { MAX_FILE_BYTES } from '@/lib/validation'

export async function POST(req: NextRequest) {
  const cl = Number(req.headers.get('content-length') ?? 0)
  if (cl > MAX_FILE_BYTES + 65536) {
    return NextResponse.json({ error: 'request too large' }, { status: 413 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    let contacts: { name: string; email: string; codeHash: string; codeSalt: string }[]
    try {
      contacts = JSON.parse(String(form.get('contacts') ?? '[]'))
    } catch {
      return NextResponse.json({ error: 'invalid contacts' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const titleRaw = form.get('title')

    const result = await createBrocode({
      creatorName: String(form.get('creatorName') ?? ''),
      creatorEmail: String(form.get('creatorEmail') ?? ''),
      creatorCodeHash: String(form.get('creatorCodeHash') ?? ''),
      creatorCodeSalt: String(form.get('creatorCodeSalt') ?? ''),
      title: titleRaw ? String(titleRaw) : undefined,
      contacts,
      file: { buffer, contentType: file.type, size: file.size },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Rewrite lib/create.test.ts**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createBrocode, ValidationError } from './create'
import { prisma } from '@/lib/prisma'
import { resetDb } from '@/tests/helpers/db'
import { makeCodeHash } from '@/tests/helpers/seed'
import { MAX_FILE_BYTES } from './validation'

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

function input(overrides = {}) {
  return {
    creatorName: 'Alice',
    creatorEmail: 'alice@example.com',
    ...makeCodeHash('111111'),  // creatorCodeHash, creatorCodeSalt
    title: 'Secret',
    contacts: [
      { name: 'Bob', email: 'bob@example.com', ...makeCodeHash('222222') },
      { name: 'Cara', email: 'cara@example.com', ...makeCodeHash('333333') },
    ],
    file: { buffer: pngBuffer, contentType: 'image/png', size: pngBuffer.length },
    ...overrides,
  }
}

// makeCodeHash returns { codeHash, codeSalt } — alias to creatorCodeHash/codeSalt
function inputWithCreatorHash(overrides = {}) {
  const { codeHash: creatorCodeHash, codeSalt: creatorCodeSalt } = makeCodeHash('111111')
  return input({ creatorCodeHash, creatorCodeSalt, ...overrides })
}

describe('createBrocode', () => {
  beforeEach(resetDb)

  it('creates a brocode with creator + contacts', async () => {
    const result = await inputWithCreatorHash() |> createBrocode
    // NOTE: pipe syntax not available — write as:
  })
})
```

Wait, I need to be more careful here. The `makeCodeHash` function returns `{ codeHash, codeSalt }` but `CreateInput` expects `creatorCodeHash` and `creatorCodeSalt`. Let me fix the test helper or the input function.

Actually, let me update `tests/helpers/seed.ts` to export a helper that returns creator fields:

```typescript
export function makeCreatorHash(code: string) {
  const { codeHash, codeSalt } = makeCodeHash(code)
  return { creatorCodeHash: codeHash, creatorCodeSalt: codeSalt }
}
```

Then the create test input helper:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createBrocode, ValidationError } from './create'
import { prisma } from '@/lib/prisma'
import { resetDb } from '@/tests/helpers/db'
import { makeCodeHash, makeCreatorHash } from '@/tests/helpers/seed'
import { MAX_FILE_BYTES } from './validation'

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

function input(overrides: Record<string, unknown> = {}) {
  return {
    creatorName: 'Alice',
    creatorEmail: 'alice@example.com',
    ...makeCreatorHash('111111'),
    title: 'Secret',
    contacts: [
      { name: 'Bob', email: 'bob@example.com', ...makeCodeHash('222222') },
      { name: 'Cara', email: 'cara@example.com', ...makeCodeHash('333333') },
    ],
    file: { buffer: pngBuffer, contentType: 'image/png', size: pngBuffer.length },
    ...overrides,
  }
}

describe('createBrocode', () => {
  beforeEach(resetDb)

  it('creates a brocode with creator + contacts and returns participant ids', async () => {
    const result = await createBrocode(input())
    expect(result.managementToken).toBeTruthy()
    expect(result.unlockToken).toBeTruthy()
    expect(result.participants).toHaveLength(3)

    const brocode = await prisma.brocode.findFirst({
      where: { managementToken: result.managementToken },
      include: { participants: true },
    })
    expect(brocode?.participants).toHaveLength(3)
    expect(brocode?.participants.find((p) => p.role === 'creator')?.email).toBe('alice@example.com')
  })

  it('rejects an unsupported file type', async () => {
    await expect(
      createBrocode(input({ file: { buffer: Buffer.from('x'), contentType: 'application/pdf', size: 1 } })),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects a file over 5MB', async () => {
    await expect(
      createBrocode(input({ file: { buffer: pngBuffer, contentType: 'image/png', size: MAX_FILE_BYTES + 1 } })),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects 0 contacts', async () => {
    await expect(createBrocode(input({ contacts: [] }))).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects 11 contacts', async () => {
    const contacts = Array.from({ length: 11 }, (_, i) => ({
      name: `C${i}`,
      email: `c${i}@x.com`,
      ...makeCodeHash(`00000${i}`),
    }))
    await expect(createBrocode(input({ contacts }))).rejects.toBeInstanceOf(ValidationError)
  })
})
```

- [ ] **Step 4: Add makeCreatorHash to tests/helpers/seed.ts**

Add to `tests/helpers/seed.ts`:

```typescript
export function makeCreatorHash(code: string) {
  const { codeHash, codeSalt } = makeCodeHash(code)
  return { creatorCodeHash: codeHash, creatorCodeSalt: codeSalt }
}
```

- [ ] **Step 5: Update tests/webhooks.test.ts**

The webhook tests use `createBrocode` which now needs hashed codes. Update the `BASE_INPUT` constant:

```typescript
import { makeCreatorHash, makeCodeHash } from './helpers/seed'

const BASE_INPUT = {
  creatorName: 'Alice',
  creatorEmail: 'alice@example.com',
  ...makeCreatorHash('111111'),
  contacts: [{ name: 'Bob', email: 'bob@example.com', ...makeCodeHash('222222') }],
  file: { buffer: TINY_PNG, contentType: 'image/png', size: TINY_PNG.length },
}
```

Also: the webhook test seeds a participant with `resendEmailId: 'resend-abc-123'` but the field is now `emailMessageId`. Update all three occurrences:

```typescript
// Change:
data: { resendEmailId: 'resend-abc-123' }
// To:
data: { emailMessageId: 'resend-abc-123' }
```

Also update the route import to use the old resend webhook (it still exists until Task 12):
```typescript
import { POST } from '@/app/api/webhooks/resend/route'
```

This can stay as-is for now — the resend webhook will be deleted in Task 12 and this test will be replaced by the SNS webhook test already written in Task 7.

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add lib/create.ts app/api/brocodes/route.ts lib/create.test.ts tests/helpers/seed.ts tests/webhooks.test.ts
git commit -m "feat: refactor create API to accept pre-hashed codes from client"
```

---

### Task 9: Manage API Refactor

Remove server-side resend (decryptCode is gone). Add code-hash update endpoint. Update PATCH email route to email-only.

**Files:**
- Create: `app/api/brocodes/manage/[managementToken]/participants/[id]/code/route.ts`
- Modify: `app/api/brocodes/manage/[managementToken]/participants/[id]/route.ts`
- Modify: `app/api/brocodes/manage/[managementToken]/resend/route.ts` — gutted (returns 410 Gone)
- Modify: `lib/manage.ts` — remove `resendContactEmail`, `updateAndResendEmail`; add `updateEmail`
- Modify: `lib/manage.test.ts` — remove tests for deleted functions

**Interfaces:**
- Consumes: `updateCodeHash(managementToken, participantId, codeHash, codeSalt)` (Task 6)
- Produces:
  - `POST /api/brocodes/manage/[token]/participants/[id]/code` → `{ ok: true }` or 404
  - `PATCH /api/brocodes/manage/[token]/participants/[id]` → email update only, no resend

- [ ] **Step 1: Create the code-hash update route**

Create `app/api/brocodes/manage/[managementToken]/participants/[id]/code/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { updateCodeHash } from '@/lib/manage'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ managementToken: string; id: string }> },
) {
  const { managementToken, id } = await params
  const body = await req.json().catch(() => ({}))
  const codeHash = String(body.codeHash ?? '').trim()
  const codeSalt = String(body.codeSalt ?? '').trim()
  if (!codeHash || !codeSalt) {
    return NextResponse.json({ error: 'codeHash and codeSalt required' }, { status: 400 })
  }
  const ok = await updateCodeHash(managementToken, id, codeHash, codeSalt)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Update PATCH participants route — email only**

Replace `app/api/brocodes/manage/[managementToken]/participants/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateEmail } from '@/lib/manage'

const emailSchema = z.email()

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ managementToken: string; id: string }> },
) {
  const { managementToken, id } = await params
  const body = await req.json().catch(() => ({}))
  const newEmail = String(body.email ?? '').trim()
  if (!newEmail || !emailSchema.safeParse(newEmail).success)
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })

  const ok = await updateEmail(managementToken, id, newEmail)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Gut the old resend route — return 410 Gone**

Replace `app/api/brocodes/manage/[managementToken]/resend/route.ts`:

```typescript
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'resend is now client-driven — use dispatch-email + participants/[id]/code' },
    { status: 410 },
  )
}
```

- [ ] **Step 4: Update lib/manage.ts**

Remove `resendContactEmail` and `updateAndResendEmail`. Add `updateEmail`. Keep `getManageData`, `updateDeliveryStatus`, `updateCodeHash`, `registerMessageId`, `deleteBrocode`.

The full updated `lib/manage.ts`:

```typescript
import { prisma } from './prisma'
import { removeAsset } from './storage'
import type { EmailDeliveryStatus } from './email/types'

export type { EmailDeliveryStatus }

export interface ManageContact {
  id: string
  name: string
  email: string
  emailDeliveryStatus: EmailDeliveryStatus
}

export interface ManageCreator {
  id: string
  email: string
  emailDeliveryStatus: EmailDeliveryStatus
}

export interface ManageData {
  title: string | null
  locked: boolean
  lockedUntil: string | null
  unlockToken: string
  creator: ManageCreator
  contacts: ManageContact[]
}

export async function getManageData(managementToken: string): Promise<ManageData | null> {
  const brocode = await prisma.brocode.findUnique({
    where: { managementToken },
    include: { participants: true },
  })
  if (!brocode) return null

  const creator = brocode.participants.find((p) => p.role === 'creator')!
  const now = new Date()
  const locked = !!brocode.lockedUntil && brocode.lockedUntil > now

  return {
    title: brocode.title,
    locked,
    lockedUntil: locked ? brocode.lockedUntil!.toISOString() : null,
    unlockToken: brocode.unlockToken,
    creator: {
      id: creator.id,
      email: creator.email,
      emailDeliveryStatus: creator.emailDeliveryStatus as EmailDeliveryStatus,
    },
    contacts: brocode.participants
      .filter((p) => p.role === 'contact')
      .map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        emailDeliveryStatus: p.emailDeliveryStatus as EmailDeliveryStatus,
      })),
  }
}

export async function updateDeliveryStatus(
  emailMessageId: string,
  status: EmailDeliveryStatus,
): Promise<void> {
  await prisma.participant.updateMany({
    where: { emailMessageId },
    data: { emailDeliveryStatus: status },
  })
}

export async function updateEmail(
  managementToken: string,
  participantId: string,
  newEmail: string,
): Promise<boolean> {
  const brocode = await prisma.brocode.findUnique({ where: { managementToken } })
  if (!brocode) return false
  const result = await prisma.participant.updateMany({
    where: { id: participantId, brocodeId: brocode.id },
    data: { email: newEmail, emailDeliveryStatus: 'PENDING', emailMessageId: null },
  })
  return result.count > 0
}

export async function updateCodeHash(
  managementToken: string,
  participantId: string,
  codeHash: string,
  codeSalt: string,
): Promise<boolean> {
  const brocode = await prisma.brocode.findUnique({ where: { managementToken } })
  if (!brocode) return false
  const result = await prisma.participant.updateMany({
    where: { id: participantId, brocodeId: brocode.id },
    data: { codeHash, codeSalt },
  })
  return result.count > 0
}

export async function registerMessageId(
  managementToken: string,
  participantId: string,
  messageId: string,
): Promise<boolean> {
  const brocode = await prisma.brocode.findUnique({ where: { managementToken } })
  if (!brocode) return false
  const result = await prisma.participant.updateMany({
    where: { id: participantId, brocodeId: brocode.id },
    data: { emailMessageId: messageId, emailDeliveryStatus: 'PENDING' },
  })
  return result.count > 0
}

export async function deleteBrocode(managementToken: string): Promise<boolean> {
  const brocode = await prisma.brocode.findUnique({ where: { managementToken } })
  if (!brocode) return false
  await removeAsset(brocode.assetObjectKey)
  await prisma.brocode.delete({ where: { id: brocode.id } })
  return true
}
```

- [ ] **Step 5: Update lib/manage.test.ts**

Remove the `resendContactEmail` test block (replaced by comment in Task 4). Update `getManageData` test to not reference `codeEncrypted`. The tests for `deleteBrocode` and `getManageData` should pass unchanged with the new `lib/manage.ts`.

Add tests for the new functions:

```typescript
describe('updateEmail', () => {
  beforeEach(resetDb)

  it('updates the email address', async () => {
    const b = await seed()
    const contact = b.participants.find((p) => p.role === 'contact')!
    const ok = await updateEmail(b.managementToken, contact.id, 'new@x.com')
    expect(ok).toBe(true)
    const updated = await prisma.participant.findUnique({ where: { id: contact.id } })
    expect(updated?.email).toBe('new@x.com')
    expect(updated?.emailDeliveryStatus).toBe('PENDING')
  })
})

describe('updateCodeHash', () => {
  beforeEach(resetDb)

  it('updates the code hash and salt', async () => {
    const b = await seed()
    const contact = b.participants.find((p) => p.role === 'contact')!
    const { codeHash, codeSalt } = makeCodeHash('999999')
    const ok = await updateCodeHash(b.managementToken, contact.id, codeHash, codeSalt)
    expect(ok).toBe(true)
    const updated = await prisma.participant.findUnique({ where: { id: contact.id } })
    expect(updated?.codeHash).toBe(codeHash)
    expect(updated?.codeSalt).toBe(codeSalt)
  })
})
```

Also add imports: `import { updateEmail, updateCodeHash, registerMessageId } from './manage'` and `import { makeCodeHash } from '@/tests/helpers/seed'`.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add \
  "app/api/brocodes/manage/[managementToken]/participants/[id]/code/route.ts" \
  "app/api/brocodes/manage/[managementToken]/participants/[id]/route.ts" \
  "app/api/brocodes/manage/[managementToken]/resend/route.ts" \
  lib/manage.ts lib/manage.test.ts
git commit -m "feat: refactor manage API to client-driven resend; add code-hash endpoint"
```

---

### Task 10: Create Page

Wire up client-side encryption and code generation in `app/page.tsx`. After create succeeds, dispatch emails and navigate to manage URL with key fragment.

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `encryptFile`, `generateCode`, `generateSalt`, `hashCode`, `saltToBase64`, `keyToFragment` from `lib/client/crypto.ts`; `renderContactCodeHtml`, `renderCreatorManageHtml`, `contactCodeSubject`, `creatorManageSubject` from `lib/email/template.ts`
- Produces: Updated create form that sends encrypted file + code hashes; dispatches emails; navigates to `/manage/[token]#key=<base64url>`

- [ ] **Step 1: Update app/page.tsx submit function**

The `submit` function in `app/page.tsx` currently (lines 38–57):

```typescript
async function submit() {
  setError(null)
  if (!file) return setError('Choose a file')
  setBusy(true)
  try {
    const form = new FormData()
    form.set('file', file)
    form.set('creatorName', creatorName)
    form.set('creatorEmail', creatorEmail)
    if (title) form.set('title', title)
    form.set('contacts', JSON.stringify(contacts))
    const res = await fetch('/api/brocodes', { method: 'POST', body: form })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? 'Failed')
    router.push(`/manage/${body.managementToken}`)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed')
    setBusy(false)
  }
}
```

Replace the entire `submit` function with:

```typescript
async function submit() {
  setError(null)
  if (!file) return setError('Choose a file')
  setBusy(true)
  try {
    // 1. Encrypt file client-side
    const { ciphertext, key } = await encryptFile(file)
    const encryptedFile = new File([ciphertext], file.name, { type: file.type })

    // 2. Generate and hash codes for creator + all contacts
    const allParticipants = [
      { name: creatorName, email: creatorEmail, role: 'creator' as const },
      ...contacts.map((c) => ({ ...c, role: 'contact' as const })),
    ]
    const participantsWithCodes = await Promise.all(
      allParticipants.map(async (p) => {
        const code = generateCode()
        const salt = generateSalt()
        const codeHash = await hashCode(code, salt)
        return { ...p, code, codeHash, codeSalt: saltToBase64(salt) }
      }),
    )

    // 3. POST /api/brocodes with encrypted file + hashes
    const creator = participantsWithCodes.find((p) => p.role === 'creator')!
    const contactParticipants = participantsWithCodes.filter((p) => p.role === 'contact')

    const form = new FormData()
    form.set('file', encryptedFile)
    form.set('creatorName', creatorName)
    form.set('creatorEmail', creatorEmail)
    form.set('creatorCodeHash', creator.codeHash)
    form.set('creatorCodeSalt', creator.codeSalt)
    if (title) form.set('title', title)
    form.set(
      'contacts',
      JSON.stringify(
        contactParticipants.map(({ name, email, codeHash, codeSalt }) => ({
          name,
          email,
          codeHash,
          codeSalt,
        })),
      ),
    )

    const res = await fetch('/api/brocodes', { method: 'POST', body: form })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? 'Failed')

    const { managementToken, unlockToken, participants: createdParticipants } = body

    // 4. Construct URLs with key fragment
    const keyFragment = `key=${keyToFragment(key)}`
    const unlockUrl = `${window.location.origin}/unlock/${unlockToken}#${keyFragment}`
    const manageUrl = `${window.location.origin}/manage/${managementToken}#${keyFragment}`

    // 5. Dispatch emails for each participant
    for (const pw of participantsWithCodes) {
      const created = createdParticipants.find((p: { email: string }) => p.email === pw.email)
      if (!created) continue

      const isCreator = pw.role === 'creator'
      const subject = isCreator
        ? creatorManageSubject({ creatorName: pw.name, title: title || undefined, code: pw.code, managementUrl: manageUrl, unlockUrl, to: pw.email })
        : contactCodeSubject({ contactName: pw.name, title: title || undefined, code: pw.code, unlockUrl, to: pw.email })
      const html = isCreator
        ? renderCreatorManageHtml({ creatorName: pw.name, code: pw.code, managementUrl: manageUrl, unlockUrl, to: pw.email, title: title || undefined })
        : renderContactCodeHtml({ contactName: pw.name, code: pw.code, unlockUrl, to: pw.email, title: title || undefined })

      const dispatchRes = await fetch('/api/dispatch-email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${managementToken}`,
        },
        body: JSON.stringify({ to: pw.email, subject, html }),
      })
      if (dispatchRes.ok) {
        const { messageId } = await dispatchRes.json()
        await fetch(`/api/brocodes/manage/${managementToken}/participants/${created.id}/message-id`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId }),
        })
      }
    }

    // 6. Navigate to manage page with key in fragment
    router.push(`/manage/${managementToken}#${keyFragment}`)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed')
    setBusy(false)
  }
}
```

- [ ] **Step 2: Add imports to app/page.tsx**

At the top of `app/page.tsx`, add after the existing imports:

```typescript
import {
  encryptFile,
  generateCode,
  generateSalt,
  hashCode,
  saltToBase64,
  keyToFragment,
} from '@/lib/client/crypto'
import {
  contactCodeSubject,
  renderContactCodeHtml,
  creatorManageSubject,
  renderCreatorManageHtml,
} from '@/lib/email/template'
```

- [ ] **Step 3: Start the dev server and test the create flow manually**

```bash
npm run dev
```

Open http://localhost:3000. Fill in the form with a test image, your name/email, at least one contact. Hold the ARM button. Verify:
- The request to `/api/brocodes` goes through
- The browser navigates to `/manage/[token]#key=...` (confirm the `#key=` fragment is in the URL)
- The manage page loads without errors

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: encrypt file and generate codes client-side on create"
```

---

### Task 11: Unlock Page + View Page

Pass the key fragment through the unlock ceremony to the view page. Decrypt the asset client-side on the view page.

**Files:**
- Modify: `app/unlock/[unlockToken]/page.tsx`
- Modify: `app/view/[viewToken]/page.tsx`

**Interfaces:**
- Consumes: `decryptAsset`, `fragmentToKey` from `lib/client/crypto.ts`
- Produces: View page decrypts asset before rendering; unlock page appends fragment to view navigation

- [ ] **Step 1: Update unlock page — pass key fragment to view navigation**

In `app/unlock/[unlockToken]/page.tsx`, find the `useEffect` that handles the `unlocked` status (around line 52):

```typescript
useEffect(() => {
  if (state?.status === 'unlocked') router.push(`/view/${state.viewToken}`)
}, [state, router])
```

Replace with:

```typescript
useEffect(() => {
  if (state?.status === 'unlocked') {
    const fragment = window.location.hash
    router.push(`/view/${state.viewToken}${fragment}`)
  }
}, [state, router])
```

- [ ] **Step 2: Update view page — decrypt asset client-side**

In `app/view/[viewToken]/page.tsx`, the page currently:
1. Fetches `GET /api/view/[viewToken]` → `{ assetKind, signedUrl }`
2. Sets `result` state
3. Renders `<img src={result.signedUrl}>` or `<video src={result.signedUrl}>`

The signed URL now points to encrypted ciphertext. Replace the component with:

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/app/components/PageHeader'
import { StatusIndicator } from '@/app/components/StatusIndicator'
import { decryptAsset, fragmentToKey } from '@/lib/client/crypto'

type ViewResult = { assetKind: 'image' | 'video'; signedUrl: string }
type Phase = 'scanning' | 'revealed' | 'gone' | 'no-key'

export default function ViewPage() {
  const { viewToken } = useParams<{ viewToken: string }>()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [assetKind, setAssetKind] = useState<'image' | 'video' | null>(null)
  const [phase, setPhase] = useState<Phase>('scanning')
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const hash = window.location.hash
    const keyParam = hash.startsWith('#key=') ? hash.slice('#key='.length) : null
    if (!keyParam) {
      setPhase('no-key')
      return
    }

    let key: Uint8Array
    try {
      key = fragmentToKey(keyParam)
    } catch {
      setPhase('no-key')
      return
    }

    fetch(`/api/view/${viewToken}`)
      .then(async (res) => {
        if (!res.ok) return setPhase('gone')
        const data: ViewResult = await res.json()
        setAssetKind(data.assetKind)

        const encryptedRes = await fetch(data.signedUrl)
        if (!encryptedRes.ok) return setPhase('gone')
        const encryptedBuffer = await encryptedRes.arrayBuffer()

        const plain = await decryptAsset(encryptedBuffer, key)
        const mimeType = data.assetKind === 'image' ? 'image/jpeg' : 'video/mp4'
        const url = URL.createObjectURL(new Blob([plain], { type: mimeType }))
        setBlobUrl(url)
        setTimeout(() => setPhase('revealed'), 900)
      })
      .catch(() => setPhase('gone'))
  }, [viewToken])

  if (phase === 'no-key') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="PAYLOAD DECRYPT" right={<StatusIndicator label="KEY MISSING" color="alert" />} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p
            className="text-2xl font-bold tracking-widest uppercase"
            style={{ color: 'var(--color-alert)', textShadow: '0 0 4px var(--color-alert)' }}
          >
            DECRYPTION KEY MISSING
          </p>
          <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-phosphor-dim)' }}>
            This link is missing the decryption key — make sure you copied the full URL.
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'gone') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" data-testid="relocked">
        <PageHeader title="PAYLOAD DECRYPT" right={<StatusIndicator label="ACCESS REVOKED" color="alert" />} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p
            className="text-2xl font-bold tracking-widest uppercase"
            style={{ color: 'var(--color-phosphor)', textShadow: '0 0 4px var(--color-phosphor), 0 0 20px var(--color-phosphor)' }}
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
      <div className="relative flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden">
        <AnimatePresence>
          {phase === 'scanning' && (
            <motion.div
              key="scanning"
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                aria-hidden="true"
                className="absolute left-0 right-0 pointer-events-none"
                style={{ height: '2px', background: 'var(--color-phosphor)', boxShadow: '0 0 24px 8px var(--color-phosphor)', zIndex: 10 }}
                initial={{ top: 0 }}
                animate={{ top: '100%' }}
                transition={{ duration: 0.8, ease: 'linear' }}
              />
              <p
                className="text-xl font-bold tracking-widest uppercase"
                style={{ color: 'var(--color-phosphor)', textShadow: '0 0 4px var(--color-phosphor), 0 0 20px var(--color-phosphor)' }}
              >
                DECRYPTING PAYLOAD…
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'revealed' && blobUrl && (
            <motion.div
              className="w-full max-w-3xl"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-xs tracking-widest uppercase mb-3 text-center" style={{ color: 'var(--color-phosphor-dim)' }}>
                PAYLOAD DECRYPTED — SINGLE-USE ACCESS
              </p>
              <motion.div
                className="relative border p-1"
                style={{ borderColor: 'var(--color-phosphor)' }}
                animate={{ boxShadow: ['0 0 16px var(--color-phosphor)', '0 0 4px var(--color-phosphor)'] }}
                transition={{ duration: 1.2, delay: 0.3 }}
              >
                {(['top-0 left-0 border-l-2 border-t-2', 'top-0 right-0 border-r-2 border-t-2', 'bottom-0 left-0 border-l-2 border-b-2', 'bottom-0 right-0 border-r-2 border-b-2'] as const).map((cls, i) => (
                  <span key={i} aria-hidden="true" className={`absolute w-4 h-4 ${cls}`} style={{ borderColor: 'var(--color-phosphor)', boxShadow: '0 0 6px var(--color-phosphor)' }} />
                ))}
                {assetKind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img data-testid="asset" src={blobUrl} alt="revealed asset" className="w-full block" />
                ) : (
                  <video data-testid="asset" src={blobUrl} controls autoPlay className="w-full block" />
                )}
              </motion.div>
              <p className="mt-3 text-xs tracking-widest uppercase text-center" style={{ color: 'var(--color-phosphor-dim)' }}>
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

Note: The `mimeType` above uses a fallback. A more robust implementation derives the type from `assetContentType` if the API returns it — but the existing `ViewResult` only returns `assetKind`. For the `Blob` URL, browsers handle rendering by the URL context (img/video tag), so the MIME type on the Blob is advisory. Pass `''` if uncertain: `new Blob([plain])`.

- [ ] **Step 3: Test manually end-to-end**

1. Create a new brocode at http://localhost:3000 with a test image
2. Confirm you navigate to `/manage/[token]#key=...`
3. Open the unlock URL (visible in the manage page) — it should have `#key=...` appended
4. Enter all codes (check the emails captured in dev — use `EMAIL_TRANSPORT=capture` and add a test endpoint or read from the capture store)
5. Confirm the view page decrypts and shows the image

- [ ] **Step 4: Commit**

```bash
git add app/unlock/"[unlockToken]"/page.tsx app/view/"[viewToken]"/page.tsx
git commit -m "feat: pass key fragment through unlock ceremony; decrypt asset client-side"
```

---

### Task 12: Manage Page + Cleanup

Update the manage page for client-driven resend (reads key from URL fragment, generates new codes). Remove all dead code: `lib/email/resend.ts`, old webhook route, `resend` and `svix` packages.

**Files:**
- Modify: `app/manage/[managementToken]/page.tsx`
- Delete: `lib/email/resend.ts`, `lib/email/index.ts`, `lib/email/types.ts`, `lib/email/capture.ts`, `lib/email/email.test.ts`
- Delete: `app/api/webhooks/resend/route.ts`
- Modify: `tests/webhooks.test.ts` — delete file (replaced by sns-webhook.test.ts in Task 7)
- Modify: `.env.example`
- Run: `npm uninstall resend svix`

**Interfaces:**
- Consumes: All prior tasks
- Produces: Fully working manage page with key-chain resend; clean package.json

- [ ] **Step 1: Update the manage page — read key from fragment**

In `app/manage/[managementToken]/page.tsx`:

Add imports:

```typescript
import {
  generateCode,
  generateSalt,
  hashCode,
  saltToBase64,
  keyToFragment,
  fragmentToKey,
} from '@/lib/client/crypto'
import {
  contactCodeSubject,
  renderContactCodeHtml,
  creatorManageSubject,
  renderCreatorManageHtml,
} from '@/lib/email/template'
```

Update the `unlockUrl` construction (currently line 165):

```typescript
// Change:
const unlockUrl = `${window.location.origin}/unlock/${data.unlockToken}`

// To:
const keyFragment = window.location.hash.startsWith('#key=')
  ? window.location.hash.slice(1) // keep "key=..." without "#"
  : null
const unlockUrl = keyFragment
  ? `${window.location.origin}/unlock/${data.unlockToken}#${keyFragment}`
  : `${window.location.origin}/unlock/${data.unlockToken}`
```

- [ ] **Step 2: Replace the resend function**

In `app/manage/[managementToken]/page.tsx`, replace the `resend` function:

```typescript
async function resend(participantId: string, email: string, name: string, isCreator = false) {
  if (!keyFragment) {
    setNotice('Cannot resend: decryption key not found in URL. Open your original email link.')
    return
  }
  try {
    // 1. Generate new code and hash it
    const code = generateCode()
    const salt = generateSalt()
    const codeHash = await hashCode(code, salt)
    const codeSalt = saltToBase64(salt)

    // 2. Update code hash in DB
    const codeRes = await fetch(
      `/api/brocodes/manage/${managementToken}/participants/${participantId}/code`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codeHash, codeSalt }),
      },
    )
    if (!codeRes.ok) { setNotice('Resend failed'); return }

    // 3. Build email
    const manageUrl = `${window.location.origin}/manage/${managementToken}#${keyFragment}`
    const subject = isCreator
      ? creatorManageSubject({ to: email, creatorName: name, code, managementUrl: manageUrl, unlockUrl: unlockUrl!, title: data?.title ?? undefined })
      : contactCodeSubject({ to: email, contactName: name, code, unlockUrl: unlockUrl!, title: data?.title ?? undefined })
    const html = isCreator
      ? renderCreatorManageHtml({ to: email, creatorName: name, code, managementUrl: manageUrl, unlockUrl: unlockUrl!, title: data?.title ?? undefined })
      : renderContactCodeHtml({ to: email, contactName: name, code, unlockUrl: unlockUrl!, title: data?.title ?? undefined })

    // 4. Dispatch email
    const dispatchRes = await fetch('/api/dispatch-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${managementToken}` },
      body: JSON.stringify({ to: email, subject, html }),
    })
    if (!dispatchRes.ok) { setNotice('Resend failed'); return }

    const { messageId } = await dispatchRes.json()

    // 5. Register message ID
    await fetch(`/api/brocodes/manage/${managementToken}/participants/${participantId}/message-id`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messageId }),
    })

    setResentIds((s) => new Set(s).add(participantId))
    setTimeout(() => setResentIds((s) => { const n = new Set(s); n.delete(participantId); return n }), 1500)
    await load()
    setNotice('Email re-sent')
  } catch {
    setNotice('Resend failed')
  }
}
```

- [ ] **Step 3: Replace saveEmail function**

```typescript
async function saveEmail(participantId: string, name: string, isCreator = false) {
  const email = editEmails[participantId]?.trim()
  if (!email) return

  // 1. Update email in DB
  const emailRes = await fetch(
    `/api/brocodes/manage/${managementToken}/participants/${participantId}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    },
  )
  if (!emailRes.ok) { setNotice('Update failed'); return }

  setEditEmails((prev) => { const n = { ...prev }; delete n[participantId]; return n })

  // 2. Resend with new email
  await resend(participantId, email, name, isCreator)
}
```

- [ ] **Step 4: Update resend and saveEmail call sites**

In the JSX, update all `resend(c.id)` calls to `resend(c.id, c.email, c.name)` and `resend(data.creator.id, data.creator.email, data.creator.email, true)` (for creator resends if applicable).

Update all `saveEmail(c.id)` calls to `saveEmail(c.id, c.name)` and `saveEmail(data.creator.id, 'creator', true)`.

Find all `onClick={() => resend(c.id)}` in the JSX and change to `onClick={() => resend(c.id, c.email, c.name)}`.

Find `onClick={() => saveEmail(c.id)}` and change to `onClick={() => saveEmail(c.id, c.name)}`.

For the creator resend/save buttons, pass `true` as the `isCreator` param.

- [ ] **Step 5: Add keyFragment to state**

At the top of the component, after the `managementToken` param:

```typescript
const [keyFragment, setKeyFragment] = useState<string | null>(null)

useEffect(() => {
  const hash = window.location.hash
  if (hash.startsWith('#key=')) setKeyFragment(hash.slice(1))
}, [])
```

- [ ] **Step 6: Delete dead files**

```bash
rm lib/email/resend.ts lib/email/index.ts lib/email/types.ts lib/email/capture.ts lib/email/email.test.ts
rm app/api/webhooks/resend/route.ts
rm tests/webhooks.test.ts
```

Note: `lib/email/template.ts` and `lib/email/template.test.ts` are kept (still used by create and manage pages).

- [ ] **Step 7: Remove resend and svix packages**

```bash
npm uninstall resend svix
```

- [ ] **Step 8: Update .env.example**

Replace the `# Email` section:

```bash
# Email — AWS SES SMTP
EMAIL_TRANSPORT=capture
SES_SMTP_USER=
SES_SMTP_PASSWORD=
SES_FROM_ADDRESS=Brocode <no-reply@yourdomain.com>
SES_REGION=us-east-1
```

Remove:
```
RESEND_API_KEY=
EMAIL_FROM=
CODE_ENCRYPTION_KEY=
```

- [ ] **Step 9: Run all tests**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 10: Run E2E tests**

```bash
npm run test:e2e
```

Expected: all E2E tests PASS. If any test relies on the old Resend webhook URL (`/api/webhooks/resend`), update it to `/api/webhooks/email`.

- [ ] **Step 11: Commit**

```bash
git add app/manage/"[managementToken]"/page.tsx .env.example package.json package-lock.json
git commit -m "feat: manage page client-driven resend with key chain; remove Resend and Svix"
```

---

## Self-Review Checklist

After writing this plan, verified against spec:

| Spec requirement | Covered in task |
|---|---|
| AES-256-GCM asset encryption, IV prepended | Task 5, Task 10 |
| Key in URL fragment, never sent to server | Task 5, Task 10, Task 11 |
| PBKDF2-SHA256, 100k iterations, same params browser+server | Task 4, Task 5 |
| Codes generated in browser, hash stored only | Task 5, Task 8, Task 10 |
| Blind dispatch endpoint (no body logging) | Task 6 |
| Management token auth on dispatch endpoint | Task 6 |
| SES SMTP via Nodemailer | Task 6 |
| SNS webhook for delivery tracking | Task 7 |
| emailMessageId replaces resendEmailId | Task 3, Task 7 |
| Schema migration (add nullable → migrate data → make required) | Tasks 1-3 |
| Migration script (decrypt → hash) | Task 2 |
| Resend/Svix removed | Task 12 |
| EMAIL_TRANSPORT=capture works for tests | Task 6 |
| Error shown if key missing from URL | Task 11 |
| Resend on manage page generates new code | Task 12 |
| Key fragment passed through unlock → view navigation | Task 11 |
| manageUrl includes key fragment | Task 10, Task 12 |
| unlockUrl in emails includes key fragment | Task 10, Task 12 |
