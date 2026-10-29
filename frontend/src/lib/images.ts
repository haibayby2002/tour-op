// Client-side preparation of image uploads. The server re-encodes every image
// anyway (EXIF stripped, resized, WebP); this only avoids sending huge files
// over slow mobile connections and catches obviously wrong files early.

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(',')
const MAX_SIDE = 2560

export class ImageUploadError extends Error {
  code: 'invalid_image_type' | 'file_too_large' | 'invalid_image'

  constructor(code: ImageUploadError['code']) {
    super(code)
    this.code = code
  }
}

/** Returns a file the server will accept: downscaled to JPEG when it's too large. */
export async function prepareImage(file: File, maxMb = 10): Promise<File> {
  const maxBytes = maxMb * 1024 * 1024
  if (!file.type.startsWith('image/')) throw new ImageUploadError('invalid_image_type')
  if (ACCEPTED_IMAGE_TYPES.includes(file.type) && file.size <= maxBytes) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file) // applies EXIF orientation
  } catch {
    // e.g. HEIC on browsers that can't decode it
    throw new ImageUploadError('invalid_image_type')
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new ImageUploadError('invalid_image')
  if (blob.size > maxBytes) throw new ImageUploadError('file_too_large')
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}
