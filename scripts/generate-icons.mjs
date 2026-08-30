/**
 * Draws Breaktime's mark and writes every raster the app and its link previews
 * need. Run with `npm run icons`; the output is committed, so this only has to
 * run when the mark changes.
 *
 * The mark: a kraft-cream disc with one wedge lifted out of it, in ube. It reads
 * as a slice of bibingka and as a wedge of a clock face at the same time, which
 * is the whole app in one shape. It is a solid silhouette with no thin strokes
 * and no text, so it survives a 16px favicon and a maskable crop.
 *
 * Wordmark text is converted to outlines by opentype.js rather than left as SVG
 * <text>, so the output does not depend on which fonts the machine running this
 * happens to have installed.
 */

import { Buffer } from 'node:buffer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')
const FONTS = join(ROOT, 'assets', 'fonts')

// The app's palette, from src/index.css. The mark introduces no new colour.
const GROUND = '#1c1310'
const CREAM = '#eddcbf'
const UBE = '#9b6fd4'
const GATA = '#f6eedf'

const SITE = 'breaktime.chefallan.xyz'
const TAGLINE = 'Merienda, sized to the break you actually have.'

const n = (v) => Number(v.toFixed(2))

function pointOn(cx, cy, r, degrees) {
  const radians = (degrees * Math.PI) / 180
  return [cx + r * Math.cos(radians), cy + r * Math.sin(radians)]
}

/** A pie slice. Angles are SVG degrees: -90 is twelve o'clock, positive is clockwise. */
function sector(cx, cy, r, from, to) {
  const [x1, y1] = pointOn(cx, cy, r, from)
  const [x2, y2] = pointOn(cx, cy, r, to)
  const large = Math.abs(to - from) > 180 ? 1 : 0
  return `M ${n(cx)} ${n(cy)} L ${n(x1)} ${n(y1)} A ${n(r)} ${n(r)} 0 ${large} 1 ${n(x2)} ${n(y2)} Z`
}

/**
 * The lifted wedge is a real hole, cut with a mask, so whatever is behind the
 * mark shows through it. Painting the gap in the background colour instead would
 * leave a dark outline anywhere the background is not flat — the lamp gradient
 * on the link-preview card, for one.
 */
function mark({ cx, cy, r, id = 'wedge' }) {
  const FROM = -90
  const TO = -12
  const gapAngle = 4.6
  const gapRadius = r * 0.075
  const box = { x: cx - r * 1.1, y: cy - r * 1.1, size: r * 2.2 }

  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="${n(box.x)}" y="${n(box.y)}" width="${n(box.size)}" height="${n(box.size)}">
      <rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.size)}" height="${n(box.size)}" fill="#fff"/>
      <path d="${sector(cx, cy, r * 1.02, FROM, TO)}" fill="#000"/>
    </mask>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${CREAM}" mask="url(#${id})"/>
    <path d="${sector(cx, cy, r - gapRadius, FROM + gapAngle, TO - gapAngle)}" fill="${UBE}"/>`
}

/** Square icon: solid ground, mark centred. `radiusRatio` is the disc against the tile. */
function iconSvg({ size = 512, radiusRatio = 0.344, rounded = 0 } = {}) {
  const r = size * radiusRatio
  const bg = rounded
    ? `<rect width="${size}" height="${size}" rx="${n(size * rounded)}" fill="${GROUND}"/>`
    : `<rect width="${size}" height="${size}" fill="${GROUND}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    ${bg}
    ${mark({ cx: size / 2, cy: size / 2, r })}
  </svg>`
}

/**
 * Lays a string out glyph by glyph, applying kerning by hand.
 *
 * opentype.js' own `getPath` runs the font's OpenType feature pipeline, and
 * throws on one of the substitution formats Bricolage Grotesque uses. Nothing
 * here needs ligatures or shaping — it is a wordmark in Latin — so stepping the
 * pen across the glyphs sidesteps that entirely.
 */
async function text(fontFile, string, { x, y, size, fill }) {
  const bytes = await readFile(join(FONTS, fontFile))
  const font = opentype.parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
  const scale = size / font.unitsPerEm

  const path = new opentype.Path()
  let pen = x
  let previous = null
  for (const character of string) {
    const glyph = font.charToGlyph(character)
    if (previous) pen += font.getKerningValue(previous, glyph) * scale
    path.extend(glyph.getPath(pen, y, size))
    pen += glyph.advanceWidth * scale
    previous = glyph
  }

  return { svg: `<path d="${path.toPathData(2)}" fill="${fill}"/>`, width: pen - x }
}

/** 1200x630, the size every link unfurler crops to. */
async function ogSvg() {
  const W = 1200
  const H = 630
  const markSize = 248
  const markX = 96
  const textX = markX + markSize + 72

  const word = await text('BricolageGrotesque-ExtraBold.ttf', 'Breaktime', {
    x: textX,
    y: 292,
    size: 122,
    fill: GATA,
  })
  const tag = await text('InstrumentSans-Medium.ttf', TAGLINE, {
    x: textX,
    y: 358,
    size: 34,
    fill: `${GATA}99`,
  })
  const url = await text('InstrumentSans-Medium.ttf', SITE, {
    x: textX,
    y: 438,
    size: 28,
    fill: UBE,
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs>
      <radialGradient id="lamp" cx="0.32" cy="0.34" r="0.78">
        <stop offset="0%" stop-color="#6b4326" stop-opacity="0.62"/>
        <stop offset="72%" stop-color="#6b4326" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="${GROUND}"/>
    <rect width="${W}" height="${H}" fill="url(#lamp)"/>
    ${mark({ cx: markX + markSize / 2, cy: H / 2, r: markSize / 2 })}
    ${word.svg}
    ${tag.svg}
    ${url.svg}
    <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${UBE}"/>
  </svg>`
}

async function png(svg, file, size) {
  const pipeline = sharp(Buffer.from(svg))
  if (size) pipeline.resize(size, size)
  await pipeline.png({ compressionLevel: 9 }).toFile(join(PUBLIC, file))
  return file
}

/**
 * A one-image .ico wrapping a PNG. Only /favicon.ico is served by convention to
 * crawlers and older clients; everything current takes the SVG.
 */
async function ico(svg, file) {
  const image = await sharp(Buffer.from(svg)).resize(32, 32).png({ compressionLevel: 9 }).toBuffer()
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // one image
  header.writeUInt8(32, 6) // width
  header.writeUInt8(32, 7) // height
  header.writeUInt8(0, 8) // palette size: not paletted
  header.writeUInt8(0, 9) // reserved
  header.writeUInt16LE(1, 10) // colour planes
  header.writeUInt16LE(32, 12) // bits per pixel
  header.writeUInt32LE(image.length, 14)
  header.writeUInt32LE(22, 18) // offset to the image data
  await writeFile(join(PUBLIC, file), Buffer.concat([header, image]))
  return file
}

await mkdir(PUBLIC, { recursive: true })

const square = iconSvg()
// Rounded, because it is shown as a tile in the install gate as well as a favicon.
const roundedSquare = iconSvg({ rounded: 0.22 })
// A maskable icon is cropped to a circle of 80% of the tile, so the mark shrinks
// to sit inside that safe zone rather than losing its edge.
const maskable = iconSvg({ radiusRatio: 0.3 })

await writeFile(join(PUBLIC, 'favicon.svg'), `${roundedSquare}\n`)

const written = [
  'favicon.svg',
  await ico(square, 'favicon.ico'),
  await png(roundedSquare, 'favicon-96.png', 96),
  await png(square, 'icon-192.png', 192),
  await png(square, 'icon-512.png', 512),
  await png(maskable, 'icon-maskable-512.png', 512),
  // iOS applies its own rounding, so this one is square and slightly inset.
  await png(iconSvg({ radiusRatio: 0.32 }), 'apple-touch-icon.png', 180),
  await png(await ogSvg(), 'og-image.png'),
]

console.log(`public/: ${written.join(', ')}`)
