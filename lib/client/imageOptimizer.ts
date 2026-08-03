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
