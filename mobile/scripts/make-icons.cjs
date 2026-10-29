// Renders the Tour-op logo (frontend/public/favicon.svg) and Google's "G" into the mobile app's PNG assets.
// Usage (from mobile/): node scripts/make-icons.cjs ../frontend assets   (sharp is resolved from the frontend)
const path = require('path')
const sharp = require(require.resolve('sharp', { paths: [process.argv[2]] }))
const out = process.argv[3]
const TEAL = '#0F766E'
const PIN = 'M32 12c-8.3 0-15 6.5-15 14.6C17 38 32 52 32 52s15-14 15-25.4C47 18.5 40.3 12 32 12Zm0 20.5a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z'
// The pin spans x 17..47, y 12..52 in a 64 box; centre it and scale it to `share` of the canvas height.
const pin = (share, fill = '#fff') => {
  const k = (64 * share) / 40
  return `<g transform="translate(32 32) scale(${k}) translate(-32 -32)"><path d="${PIN}" fill="${fill}"/></g>`
}
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${body}</svg>`)
const GOOGLE = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`)

const jobs = [
  ['icon.png', 1024, svg(`<rect width="64" height="64" fill="${TEAL}"/>${pin(0.62)}`)],
  ['store/play-icon-512.png', 512, svg(`<rect width="64" height="64" fill="${TEAL}"/>${pin(0.62)}`)],
  ['android-icon-background.png', 1024, svg(`<rect width="64" height="64" fill="${TEAL}"/>`)],
  ['android-icon-foreground.png', 1024, svg(pin(0.42))], // inside the 66% adaptive-icon safe zone
  ['android-icon-monochrome.png', 1024, svg(pin(0.42))],
  ['notification-icon.png', 96, svg(pin(0.8))],
  ['splash-icon.png', 1024, svg(`<rect width="64" height="64" rx="14" fill="${TEAL}"/><path d="${PIN}" fill="#fff"/>`)],
  ['logo.png', 192, svg(`<rect width="64" height="64" rx="14" fill="${TEAL}"/><path d="${PIN}" fill="#fff"/>`)],
  ['favicon.png', 48, svg(`<rect width="64" height="64" rx="14" fill="${TEAL}"/><path d="${PIN}" fill="#fff"/>`)],
  ['google-g.png', 96, GOOGLE],
]
;(async () => {
  for (const [name, size, src] of jobs) {
    const file = path.join(out, name)
    require('fs').mkdirSync(path.dirname(file), { recursive: true })
    await sharp(src, { density: 1200 }).resize(size, size).png().toFile(file)
    console.log('wrote', name, size)
  }
})()
