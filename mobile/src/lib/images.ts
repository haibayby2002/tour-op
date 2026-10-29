import * as ImagePicker from 'expo-image-picker'

import { filePart } from './api'

/** Error whose `code` matches an `errors.*` translation key. */
export class ImageUploadError extends Error {
  code: string

  constructor(code: 'file_too_large' | 'invalid_image_type') {
    super(code)
    this.code = code
  }
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Opens the photo library. Returns [] when cancelled. The picker re-encodes to
 * JPEG at `quality`, which keeps phone photos well under the server limit; the
 * server then strips metadata and resizes.
 */
export async function pickImages({
  multiple = false,
  limit = 1,
  square = false,
  maxMb = 10,
}: { multiple?: boolean; limit?: number; square?: boolean; maxMb?: number } = {}) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? limit : 1,
    allowsEditing: square && !multiple,
    aspect: square ? [1, 1] : undefined,
    quality: 0.8,
    exif: false,
  })
  if (result.canceled) return []
  const assets = result.assets.slice(0, limit)
  for (const asset of assets) {
    if (asset.fileSize && asset.fileSize > maxMb * 1024 * 1024) throw new ImageUploadError('file_too_large')
    if (asset.mimeType && !ACCEPTED.includes(asset.mimeType)) throw new ImageUploadError('invalid_image_type')
  }
  return assets.map((a, i) => filePart(a.uri, a.fileName ?? `photo-${i}.jpg`, a.mimeType ?? 'image/jpeg'))
}
