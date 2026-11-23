// Gera build/icon.ico (16–256 px) a partir de src/dota-logo.png. Uso: npm run make:icon
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const sizes = [16, 32, 48, 64, 128, 256]
const images = await Promise.all(sizes.map(size => sharp(path.join(root, 'src', 'dota-logo.png'))
  .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()))
const head = Buffer.alloc(6)
head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4)
let offset = 6 + 16 * sizes.length
const dirs = images.map((data, i) => {
  const entry = Buffer.alloc(16)
  entry[0] = sizes[i] === 256 ? 0 : sizes[i]; entry[1] = entry[0]
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(data.length, 8); entry.writeUInt32LE(offset, 12)
  offset += data.length
  return entry
})
fs.mkdirSync(path.join(root, 'build'), { recursive: true })
fs.writeFileSync(path.join(root, 'build', 'icon.ico'), Buffer.concat([head, ...dirs, ...images]))
console.log('build/icon.ico gerado: ' + sizes.join(', ') + ' px')
