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
