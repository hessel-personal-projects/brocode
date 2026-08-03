# Image Optimization Before Upload

**Date:** 2026-08-03
**Status:** Approved

## Problem

Images uploaded by users can be large. The current flow encrypts and uploads the raw file with no preprocessing, which wastes storage and bandwidth. The 5 MB cap rejects files that could easily fit after optimization.

## Goal

Reduce image file sizes before encryption and upload, with no perceptible quality loss. Videos and animated GIFs are out of scope.

## Approach

Convert all optimizable images to WebP at quality 0.85 using the browser's canvas API. HEIC/HEIF files (iPhone default format) are decoded first via the `heic2any` library, then fed into the same canvas pipeline.

## Optimization Matrix

| Input type | Optimization |
|---|---|
| JPEG, PNG, WebP | canvas → WebP at quality 0.85 |
| HEIC / HEIF | `heic2any()` → canvas → WebP at quality 0.85 |
| GIF | pass-through unchanged |
| Video (mp4, webm) | pass-through unchanged |

## Architecture

### New module: `lib/client/imageOptimizer.ts`

Single exported function:

```ts
optimizeImage(file: File): Promise<File>
```

**Logic:**

1. If `file.type` starts with `video/`, or is `image/gif` — return file unchanged.
2. If `file.type` is `image/heic` or `image/heif`:
   - Lazy-load `heic2any` via dynamic `import('heic2any')`.
   - Convert to a JPEG blob using `heic2any({ blob: file, toType: 'image/jpeg' })`.
   - Use the JPEG blob as input to step 3.
3. Decode via `createImageBitmap(input)`.
4. Draw onto `new OffscreenCanvas(width, height)` at natural dimensions (no resizing).
5. Export: `canvas.convertToBlob({ type: 'image/webp', quality: 0.85 })`.
6. Return `new File([blob], stem + '.webp', { type: 'image/webp' })` where `stem` is the original filename without extension.
7. On any error: catch, log a warning, return the original file unchanged so upload still proceeds.

### Updated upload flow in `app/page.tsx`

Before (relevant section):
```
validate size → encryptFile(file) → fetch signed URL → PUT
```

After:
```
optimizeImage(file) → validate size → encryptFile(optimized) → fetch signed URL → PUT
```

Size validation moves to after optimization so a file slightly over 5 MB can be optimized below the cap rather than immediately rejected.

A `"OPTIMIZING..."` status string is shown in the existing upload status display while `optimizeImage` runs, then cleared on completion.

### Server-side changes: `lib/validation.ts`

Add HEIC and HEIF to the `CONTENT_TYPES` map:

```ts
'image/heic': { kind: 'image', ext: 'heic' },
'image/heif': { kind: 'image', ext: 'heif' },
```

This allows the signed-URL endpoint to accept HEIC uploads (in the rare case optimization fails and the original is passed through).

### UI: `app/page.tsx` file input

Update `accept` attribute:

```
accept="image/*,video/*,.heic,.heif"
```

The explicit `.heic,.heif` entries are needed because some browsers do not include HEIC in `image/*`.

## Dependencies

| Package | Why | Load strategy |
|---|---|---|
| `heic2any` | HEIC/HEIF decode in Chrome/Firefox (no native support) | Dynamic import, only on HEIC input |

## Error Handling

- `optimizeImage` catches all errors and falls back to the original file. Upload always proceeds.
- If `heic2any` fails to load or decode, the original HEIC file is returned. The signed-URL endpoint accepts HEIC, so the upload succeeds as-is.

## Files Changed

| File | Change |
|---|---|
| `lib/client/imageOptimizer.ts` | New file — optimization logic |
| `app/page.tsx` | Call `optimizeImage`, move size validation, add `"OPTIMIZING..."` status, update `accept` attribute |
| `lib/validation.ts` | Add `image/heic` and `image/heif` to `CONTENT_TYPES` |
| `package.json` | Add `heic2any` dependency |

## Out of Scope

- Resizing or changing image dimensions
- Video optimization
- Animated GIF conversion
- Changing the 5 MB size cap
