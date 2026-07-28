# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Brocode is a shared-key media unlock ceremony app. A creator uploads an encrypted media file and assigns operatives, each receiving a private 6-digit code by email. The content is only revealed when all operatives enter their codes in sequence at the same URL — one wrong code triggers a 24-hour lockout. The aesthetic is a military/spy CRT terminal theme.

## Commands

```bash
pnpm dev              # Start Next.js dev server
pnpm build            # Production build
pnpm lint             # ESLint
pnpm test             # Run all unit/integration tests (vitest run)
pnpm test:watch       # Vitest in watch mode
pnpm test:e2e         # Playwright E2E tests (requires dev server running)

# Run a single test file
pnpm vitest run tests/unlock.test.ts

# Database
pnpm db:migrate       # prisma migrate dev (applies pending migrations)
pnpm db:generate      # prisma generate (regenerate client after schema changes)

# Local Supabase (Docker via Colima)
pnpm supabase:start   # Start local Supabase stack
pnpm supabase:stop    # Stop it
```

Integration tests require a running local Supabase (`pnpm supabase:start`). E2E tests spin up `pnpm dev` automatically with `EMAIL_TRANSPORT=capture`.

## Architecture

### Encryption model (critical invariant)

The AES-GCM encryption key **never touches the server**. It lives only in the URL fragment (`#key=...`). The flow:

1. `lib/client/crypto.ts` encrypts the file in the browser, produces ciphertext.
2. A signed upload URL is fetched from `/api/brocodes/upload-url`; the ciphertext is uploaded directly to Supabase Storage (bypasses Vercel size limits).
3. All participant codes are PBKDF2-hashed client-side; only the hashes are sent to the server.
4. After creation, the creator is redirected to `/manage/[managementToken]#key=...` — the fragment holds the key.
5. At `/view/[viewToken]`, the browser reads the key from the fragment and decrypts the download.

`lib/crypto.ts` is the server-side counterpart — PBKDF2 `verifyCode()` and `generateToken()` only; no AES.

### Unlock state machine

`lib/unlock.ts` manages the code ceremony. States:

- `locked` — no active session
- `in_progress` — session active, codes being collected; session expires after `UNLOCK_SESSION_TTL_MS` (10 min)
- `detonated` — wrong code submitted; `lockedUntil` set for 24 h, session deleted atomically
- `expired` — session TTL elapsed before all codes entered
- `unlocked` — all codes matched; single-use `viewToken` issued (TTL: 2 min)

`lib/constants.ts` holds all TTL/timeout values.

### Database (Prisma + Supabase Postgres)

Three models in `prisma/schema.prisma`:
- `Brocode` — core entity with `managementToken` (creator), `unlockToken` (shared), `assetObjectKey` (storage), optional `lockedUntil`
- `Participant` — role `creator|contact`, stores `codeHash`+`codeSalt`, email delivery state (`emailDeliveryStatus`: PENDING/DELIVERED/BOUNCED/FAILED)
- `UnlockSession` — tracks ceremony progress: `matchedParticipantIds` (JSON), `expiresAt`, `viewToken`

Prisma uses `@prisma/adapter-pg` (PgAdapter), configured in `lib/prisma.ts`. `prisma.config.ts` loads `.env.local` explicitly.

### API routes

All under `app/api/`. Auth is token-based:
- Management routes (`/api/brocodes/manage/[managementToken]/...`) verify `managementToken` from URL
- Email dispatch (`/api/dispatch-email`) uses `Authorization: Bearer <managementToken>`
- Webhook (`/api/webhooks/email`) receives AWS SNS delivery events to update `emailDeliveryStatus`

### Email

`lib/email/ses.ts` — Nodemailer SES SMTP transporter. Set `EMAIL_TRANSPORT=capture` in `.env.local` to suppress real sends (used in tests and E2E; returns a fake `messageId`).

### Testing

- **Unit/integration tests** (`tests/`, `lib/**/*.test.ts`): Vitest, node environment, serial (`fileParallelism: false`), each file truncates DB tables in `beforeEach`. Require live Postgres.
- **E2E** (`e2e/`): Playwright, 1 worker (shared in-memory email capture store), dev server auto-started.

### Path alias

`@/*` resolves to the project root (e.g., `@/lib/prisma`, `@/app/components/Panel`).
