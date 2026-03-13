#!/usr/bin/env node
// Generates PWA icons (icon-192.png, icon-512.png) with KSQ branding
import sharp from "sharp"

const PRIMARY = "#6366F1"
const WHITE = "#FFFFFF"

function createSvg(size) {
  const fontSize = Math.round(size * 0.3)
  const subSize = Math.round(size * 0.1)
  const radius = Math.round(size * 0.18)
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${PRIMARY}"/>
  <text x="50%" y="46%" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui,sans-serif" font-weight="700" font-size="${fontSize}" fill="${WHITE}">KSQ</text>
  <text x="50%" y="72%" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui,sans-serif" font-weight="400" font-size="${subSize}" fill="${WHITE}" opacity="0.8">NZ Quotes</text>
</svg>`
}

for (const size of [192, 512]) {
  await sharp(Buffer.from(createSvg(size)))
    .png()
    .toFile(`public/icon-${size}.png`)
  console.log(`✓ public/icon-${size}.png (${size}x${size})`)
}
