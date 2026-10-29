import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { cx } from './ui'

/**
 * Homepage hero. The artwork (public/home/slide-*.webp, made from /carousel) has its headline and button
 * drawn in, so each slide is one big link and the alt text carries the same words for screen readers.
 * Native scroll-snap does the swiping; autoplay pauses on hover, focus, touch and for reduced motion.
 */
const SLIDES = [
  { id: 'food', to: '/explore?category=food' },
  { id: 'perspective', to: '/explore?sort=rating' },
  { id: 'interests', to: '/explore' },
  { id: 'confidence', to: '/explore?verified=1' },
] as const

const INTERVAL = 6000

export default function HeroCarousel() {
  const { t } = useTranslation()
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reducedMotion = useRef(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)

  const goTo = useCallback((i: number) => {
    const el = track.current
    if (!el) return
    const next = (i + SLIDES.length) % SLIDES.length
    el.scrollTo({ left: next * el.clientWidth, behavior: reducedMotion.current ? 'auto' : 'smooth' })
  }, [])

  // Keep the dots in sync with manual swipes.
  useEffect(() => {
    const el = track.current
    if (!el) return
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (paused || reducedMotion.current) return
    const timer = setTimeout(() => goTo(index + 1), INTERVAL)
    return () => clearTimeout(timer)
  }, [index, paused, goTo])

  const arrow = 'absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-stone-900 shadow-md backdrop-blur transition hover:bg-white sm:flex dark:text-stone-50'

  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-stone-100 shadow-sm ring-1 ring-stone-200"
      aria-roledescription="carousel"
      aria-label={t('home.carousel.label')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SLIDES.map((slide, i) => (
          <Link
            key={slide.id}
            to={slide.to}
            className="relative block aspect-[16/9] w-full shrink-0 snap-start"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${SLIDES.length}: ${t(`home.carousel.${slide.id}`)}`}
            tabIndex={i === index ? 0 : -1}
          >
            <img
              src={`/home/slide-${slide.id}-1600.webp`}
              srcSet={`/home/slide-${slide.id}-960.webp 960w, /home/slide-${slide.id}-1600.webp 1600w`}
              sizes="(min-width: 1152px) 1120px, 100vw"
              alt={t(`home.carousel.${slide.id}`)}
              className="h-full w-full object-cover"
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
              draggable={false}
            />
          </Link>
        ))}
      </div>

      <button type="button" className={cx(arrow, 'left-3')} onClick={() => goTo(index - 1)} aria-label={t('home.carousel.prev')}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button type="button" className={cx(arrow, 'right-3')} onClick={() => goTo(index + 1)} aria-label={t('home.carousel.next')}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`${t('home.carousel.go_to')} ${i + 1}`}
            aria-current={i === index}
            className={cx('h-2 rounded-full shadow transition-all', i === index ? 'w-6 bg-brand-700' : 'w-2 bg-white/80 hover:bg-white')}
          />
        ))}
      </div>
    </section>
  )
}
