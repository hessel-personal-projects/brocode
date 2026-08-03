# Image Optimization Before Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize images to WebP at quality 0.85 (HEIC via heic2any → canvas) in the browser before AES-GCM encryption and Supabase upload.

**Architecture:** A new `lib/client/imageOptimizer.ts` module with a single `optimizeImage(file)` function slots into `app/page.tsx` between file selection and encryption. HEIC/HEIF is lazy-decoded via `heic2any`; all other optimizable images go directly to canvas. GIFs and videos pass through unchanged.

**Tech Stack:** Browser Canvas API (`OffscreenCanvas`, `createImageBitmap`), `heic2any` (dynamic import), Vitest with `vi.stubGlobal` for browser API mocks.

## Global Constraints

- No resizing or dimension changes — canvas is drawn at the image's natural dimensions.
- WebP quality: exactly `0.85`.
- Any error in `optimizeImage` must fall back to the original `File` silently (log a warning, never throw to the caller).
- Tests run in `environment: 'node'`; browser APIs (`OffscreenCanvas`, `createImageBitmap`) must be mocked via `vi.stubGlobal`.
- Size check (`> 5 * 1024 * 1024`) must happen *after* optimization (so a file slightly over 5 MB can optimize below the cap).
- Use `pnpm`, not `npm`.

---

### Task 1: Install heic2any and extend validation

**Files:**
- Modify: `lib/validation.ts:7-14` — add HEIC/HEIF entries to `CONTENT_TYPES`
- Modify: `lib/validation.test.ts:6-9` — add assertions for new types
- Run: `pnpm add heic2any`

**Interfaces:**
- Produces: `assetInfoFor('image/heic')` returns `{ kind: 'image', ext: 'heic' }` and `assetInfoFor('image/heif')` returns `{ kind: 'image', ext: 'heif' }`.

- [ ] **Step 1: Install heic2any**

```bash
pnpm add heic2any
```

- [ ] **Step 2: Write failing tests for HEIC/HEIF in validation**

In `lib/validation.test.ts`, extend the existing `'maps allowed image types'` test to also cover HEIC:

```typescript
it('maps allowed image types', () => {
  expect(assetInfoFor('image/png')).toEqual({ kind: 'image', ext: 'png' })
  expect(assetInfoFor('image/jpeg')?.kind).toBe('image')
  expect(assetInfoFor('image/gif')?.kind).toBe('image')
  expect(assetInfoFor('image/webp')?.kind).toBe('image')
  expect(assetInfoFor('image/heic')).toEqual({ kind: 'image', ext: 'heic' })
  expect(assetInfoFor('image/heif')).toEqual({ kind: 'image', ext: 'heif' })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm vitest run lib/validation.test.ts
```

Expected: FAIL — `assetInfoFor('image/heic')` returns `null`.

- [ ] **Step 4: Add HEIC/HEIF to CONTENT_TYPES in `lib/validation.ts`**

```typescript
const CONTENT_TYPES: Record<string, { kind: AssetKind; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/gif': { kind: 'image', ext: 'gif' },
  'image/webp': { kind: 'image', ext: 'webp' },
  'image/heic': { kind: 'image', ext: 'heic' },
  'image/heif': { kind: 'image', ext: 'heif' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/webm': { kind: 'video', ext: 'webm' },
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm vitest run lib/validation.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/validation.ts lib/validation.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add heic2any dependency and HEIC/HEIF to validation allowlist"
```

---

### Task 2: Create imageOptimizer module with unit tests

**Files:**
- Create: `lib/client/imageOptimizer.ts`
- Create: `lib/client/imageOptimizer.test.ts`

**Interfaces:**
- Produces: `optimizeImage(file: File): Promise<File>` — exported from `lib/client/imageOptimizer.ts`. Returns a new `File` of type `image/webp` for optimizable inputs; returns the original `file` reference unchanged for GIFs, videos, and on error.

- [ ] **Step 1: Write the failing tests**

Create `lib/client/imageOptimizer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock browser globals before importing the module under test.
// OffscreenCanvas and createImageBitmap are not available in Node.
const mockConvertToBlob = vi.fn()
const mockDrawImage = vi.fn()

vi.stubGlobal(
  'OffscreenCanvas',
  vi.fn().mockImplementation((_w: number, _h: number) => ({
    getContext: () => ({ drawImage: mockDrawImage }),
    convertToBlob: mockConvertToBlob,
  })),
)

vi.stubGlobal(
  'createImageBitmap',
  vi.fn(async () => ({ width: 200, height: 150, close: vi.fn() })),
)

vi.mock('heic2any', () => ({
  default: vi.fn(async () => new Blob(['jpeg-data'], { type: 'image/jpeg' })),
}))

// Import AFTER stubbing globals so the module captures the mocked versions.
const { optimizeImage } = await import('./imageOptimizer')
const { default: heic2any } = await import('heic2any')

describe('optimizeImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConvertToBlob.mockResolvedValue(new Blob(['webp-data'], { type: 'image/webp' }))
  })

  it('returns video files unchanged without touching canvas', async () => {
    const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' })
    const result = await optimizeImage(file)
    expect(result).toBe(file)
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it('returns GIF unchanged without touching canvas', async () => {
    const file = new File(['data'], 'anim.gif', { type: 'image/gif' })
    const result = await optimizeImage(file)
    expect(result).toBe(file)
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it('converts JPEG to WebP at quality 0.85', async () => {
    const file = new File(['jpeg-data'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await optimizeImage(file)
    expect(result.type).toBe('image/webp')
    expect(result.name).toBe('photo.webp')
    expect(mockConvertToBlob).toHaveBeenCalledWith({ type: 'image/webp', quality: 0.85 })
  })

  it('converts PNG to WebP', async () => {
    const file = new File(['png-data'], 'screenshot.png', { type: 'image/png' })
    const result = await optimizeImage(file)
    expect(result.type).toBe('image/webp')
    expect(result.name).toBe('screenshot.webp')
  })

  it('converts HEIC via heic2any then to WebP', async () => {
    const file = new File(['heic-data'], 'iphone.heic', { type: 'image/heic' })
    const result = await optimizeImage(file)
    expect(heic2any).toHaveBeenCalledWith({ blob: file, toType: 'image/jpeg' })
    expect(result.type).toBe('image/webp')
    expect(result.name).toBe('iphone.webp')
  })

  it('converts HEIF via heic2any then to WebP', async () => {
    const file = new File(['heif-data'], 'burst.heif', { type: 'image/heif' })
    const result = await optimizeImage(file)
    expect(heic2any).toHaveBeenCalledWith({ blob: file, toType: 'image/jpeg' })
    expect(result.type).toBe('image/webp')
    expect(result.name).toBe('burst.webp')
  })

  it('strips extension correctly when filename has multiple dots', async () => {
    const file = new File(['data'], 'my.photo.jpeg', { type: 'image/jpeg' })
    const result = await optimizeImage(file)
    expect(result.name).toBe('my.photo.webp')
  })

  it('falls back to original file when createImageBitmap throws', async () => {
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('decode failed'))
    const file = new File(['data'], 'broken.jpg', { type: 'image/jpeg' })
    const result = await optimizeImage(file)
    expect(result).toBe(file)
  })

  it('falls back to original file when heic2any throws', async () => {
    vi.mocked(heic2any).mockRejectedValueOnce(new Error('unsupported'))
    const file = new File(['data'], 'broken.heic', { type: 'image/heic' })
    const result = await optimizeImage(file)
    expect(result).toBe(file)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm vitest run lib/client/imageOptimizer.test.ts
```

Expected: FAIL — `Cannot find module './imageOptimizer'`

- [ ] **Step 3: Implement `lib/client/imageOptimizer.ts`**

```typescript
export async function optimizeImage(file: File): Promise<File> {
  try {
    if (file.type.startsWith('video/') || file.type === 'image/gif') {
      return file
    }

    let source: Blob = file
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      const heic2any = (await import('heic2any')).default
      const result = await heic2any({ blob: file, toType: 'image/jpeg' })
      source = Array.isArray(result) ? result[0] : result
    }

    const bitmap = await createImageBitmap(source)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    const webpBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 })
    const stem = file.name.replace(/\.[^.]+$/, '')
    return new File([webpBlob], `${stem}.webp`, { type: 'image/webp' })
  } catch (err) {
    console.warn('[imageOptimizer] optimization failed, using original:', err)
    return file
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm vitest run lib/client/imageOptimizer.test.ts
```

Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/client/imageOptimizer.ts lib/client/imageOptimizer.test.ts
git commit -m "feat: add imageOptimizer — canvas WebP conversion with HEIC support"
```

---

### Task 3: Wire imageOptimizer into app/page.tsx

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `optimizeImage(file: File): Promise<File>` from `@/lib/client/imageOptimizer`

The changes to `app/page.tsx` are surgical — only the `submit` function, one import, one state variable, two JSX strings, and the `accept` attribute change. Leave everything else untouched.

- [ ] **Step 1: Add the import and busyLabel state**

At the top of `app/page.tsx`, add `optimizeImage` to the client import block:

```typescript
import {
  encryptFile,
  generateCode,
  generateSalt,
  hashCode,
  saltToBase64,
  keyToFragment,
} from '@/lib/client/crypto'
import { optimizeImage } from '@/lib/client/imageOptimizer'
```

Inside `CreatePage`, add a state variable for the busy-phase label (after the existing `const [busy, setBusy] = useState(false)` line):

```typescript
const [busyLabel, setBusyLabel] = useState('ARMING…')
```

- [ ] **Step 2: Rewrite the `submit` function**

Replace the entire `submit` function body with the updated flow. Key changes:
- Remove the early size check (`if (file.size > 5 * 1024 * 1024)`)
- Add `optimizeImage` call before encryption with label state transitions
- Replace all uses of `file.type` and `file.size` with `optimized.type` and `optimized.size`
- Replace `encryptFile(file)` with `encryptFile(optimized)`
- Throw on size violation (caught by the existing catch block)

```typescript
async function submit() {
  setError(null)
  if (!file) return setError('Choose a file')
  setBusy(true)
  try {
    // 1. Optimize image client-side (no-op for video/gif)
    setBusyLabel('OPTIMIZING…')
    const optimized = await optimizeImage(file)
    setBusyLabel('ARMING…')

    if (optimized.size > 5 * 1024 * 1024) throw new Error('Payload exceeds 5 MB limit')

    // 2. Encrypt file client-side
    const { ciphertext, key } = await encryptFile(optimized)

    // 3. Get signed upload URL from server
    const uploadUrlRes = await fetch('/api/brocodes/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: optimized.type, size: optimized.size }),
    })
    if (!uploadUrlRes.ok) throw new Error((await uploadUrlRes.json()).error ?? 'upload-url failed')
    const { objectKey, uploadUrl, assetKind } = await uploadUrlRes.json()

    // 4. Upload encrypted file directly to Supabase Storage (bypasses Vercel size limit)
    const storageRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: ciphertext,
      headers: { 'Content-Type': optimized.type, 'x-upsert': 'false' },
    })
    if (!storageRes.ok) throw new Error(storageRes.status === 413 ? 'Payload exceeds 5 MB limit' : 'Upload failed')

    // 5. Generate and hash codes for creator + all contacts
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

    // 6. POST metadata only to /api/brocodes
    const creator = participantsWithCodes.find((p) => p.role === 'creator')!
    const contactParticipants = participantsWithCodes.filter((p) => p.role === 'contact')

    const res = await fetch('/api/brocodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectKey,
        contentType: optimized.type,
        assetKind,
        creatorName,
        creatorEmail,
        creatorCodeHash: creator.codeHash,
        creatorCodeSalt: creator.codeSalt,
        title: title || undefined,
        contacts: contactParticipants.map(({ name, email, codeHash, codeSalt }) => ({
          name, email, codeHash, codeSalt,
        })),
      }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? 'Failed')

    const { managementToken, unlockToken, participants: createdParticipants } = body

    // 7. Construct URLs with key fragment
    const keyFragment = `key=${keyToFragment(key)}`
    const unlockUrl = `${window.location.origin}/unlock/${unlockToken}#${keyFragment}`
    const manageUrl = `${window.location.origin}/manage/${managementToken}#${keyFragment}`

    // 8. Dispatch emails for each participant
    try {
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

        await fetch('/api/dispatch-email', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${managementToken}`,
          },
          body: JSON.stringify({ to: pw.email, subject, html, participantId: created.id }),
        })
      }
    } catch {
      // Ignore email dispatch errors - navigation should still happen
    }

    // 9. Navigate to manage page with key in fragment
    router.push(`/manage/${managementToken}#${keyFragment}`)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed')
    setBusyLabel('ARMING…')
    setBusy(false)
  }
}
```

- [ ] **Step 3: Update the two JSX strings that use the busy label**

Find the `StatusIndicator` in the JSX (`app/page.tsx` line ~163) and update its `label` prop:

Old:
```tsx
<StatusIndicator label={busy ? 'ARMING…' : 'SYSTEM READY'} color="phosphor" />
```

New:
```tsx
<StatusIndicator label={busy ? busyLabel : 'SYSTEM READY'} color="phosphor" />
```

Leave the `HoldButton` children unchanged — it shows "ARMING BROCODE…" for the full duration of the submit flow, which is correct.

- [ ] **Step 4: Update the file input `accept` attribute**

Find the `<input type="file" ...>` (~line 305-309) and update `accept`:

Old:
```tsx
accept="image/*,video/*"
```

New:
```tsx
accept="image/*,video/*,.heic,.heif"
```

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
pnpm test
```

Expected: All existing tests PASS (no tests cover the page component directly; the optimizer tests from Task 2 also pass).

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat: optimize images to WebP before upload, add HEIC/HEIF support"
```
