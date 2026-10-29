import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { IMAGE_ACCEPT, prepareImage } from '../lib/images'
import { useMeta } from '../lib/queries'
import { cx, Spinner } from './ui'

export interface ViewablePhoto {
  id: number
  image: string
  thumbnail?: string | null
  caption?: string
}

const thumbOf = (p: ViewablePhoto) => p.thumbnail || p.image

/** Square thumbnails; click opens the full-size viewer. `overlay` renders per-photo controls. */
export function PhotoGrid({
  photos,
  className = 'grid grid-cols-2 gap-2 sm:grid-cols-3',
  imageClassName = 'aspect-square w-full rounded-xl',
  showCaptions = true,
  overlay,
}: {
  photos: ViewablePhoto[]
  className?: string
  imageClassName?: string
  showCaptions?: boolean
  overlay?: (photo: ViewablePhoto) => ReactNode
}) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <div className={className}>
        {photos.map((p, i) => (
          <figure key={p.id} className="relative">
            <button
              type="button"
              className="block w-full overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:outline-none"
              onClick={() => setOpen(i)}
              aria-label={p.caption || undefined}
            >
              <img
                src={thumbOf(p)}
                alt={p.caption ?? ''}
                loading="lazy"
                className={cx(imageClassName, 'bg-stone-100 object-cover transition hover:opacity-90')}
              />
            </button>
            {overlay?.(p)}
            {showCaptions && p.caption && <figcaption className="mt-1 truncate text-xs text-stone-500">{p.caption}</figcaption>}
          </figure>
        ))}
      </div>
      {open !== null && photos[open] && <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  )
}

export function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: ViewablePhoto[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const count = photos.length
  const go = useCallback((step: number) => onIndex((index + step + count) % count), [index, count, onIndex])
  const photo = photos[index]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [go, onClose])

  const navButton = 'absolute top-1/2 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-2xl text-white hover:bg-white/25'
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-[60] flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-sm text-white/80">
        <span>{count > 1 && t('photos.counter', { current: index + 1, total: count })}</span>
        <button className="rounded-full px-3 py-1 text-xl text-white hover:bg-white/15" onClick={onClose} aria-label={t('common.close')}>
          ✕
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
        <img key={photo.id} src={photo.image} alt={photo.caption ?? ''} className="max-h-full max-w-full rounded-lg object-contain" />
        {count > 1 && (
          <>
            <button className={cx(navButton, 'left-2 sm:left-6')} onClick={() => go(-1)} aria-label={t('photos.previous')}>‹</button>
            <button className={cx(navButton, 'right-2 sm:right-6')} onClick={() => go(1)} aria-label={t('photos.next')}>›</button>
          </>
        )}
      </div>
      <p className="min-h-14 p-4 text-center text-sm text-white/90" onClick={(e) => e.stopPropagation()}>{photo.caption}</p>
    </div>
  )
}

/**
 * File picker for images. Files are checked/downscaled client-side, then passed
 * to `onFiles` (which does the upload). Errors go to `onError`.
 */
export function ImageUploadButton({
  children,
  onFiles,
  onError,
  multiple,
  pending,
  disabled,
  className = 'btn-secondary btn-sm',
}: {
  children: ReactNode
  onFiles: (files: File[]) => void | Promise<unknown>
  onError: (error: unknown) => void
  multiple?: boolean
  pending?: boolean
  disabled?: boolean
  className?: string
}) {
  const { data: meta } = useMeta()
  const [preparing, setPreparing] = useState(false)
  const busy = pending || preparing

  return (
    <label className={cx(className, 'cursor-pointer gap-2', (busy || disabled) && 'pointer-events-none opacity-60')}>
      {busy && <Spinner className="h-4 w-4" />}
      {children}
      <input
        type="file"
        accept={IMAGE_ACCEPT}
        multiple={multiple}
        className="hidden"
        disabled={busy || disabled}
        onChange={async (e) => {
          const picked = Array.from(e.target.files ?? [])
          e.target.value = '' // allow choosing the same file again
          if (!picked.length) return
          setPreparing(true)
          try {
            onError(null)
            const files = await Promise.all(picked.map((f) => prepareImage(f, meta?.image_upload.max_mb)))
            await onFiles(files)
          } catch (error) {
            onError(error)
          } finally {
            setPreparing(false)
          }
        }}
      />
    </label>
  )
}
