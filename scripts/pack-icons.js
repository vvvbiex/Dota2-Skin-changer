// Converte os PNGs do cache local em WebP (256px máx., qualidade 78) e gera assets/icons-pack.zip (STORE).
// Uso: npm run pack:icons [-- <pasta-do-cache>]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { writeZipStore } from '../core/zip.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
const source = process.argv[2] || path.join(appData, 'dota-local-skin-changer', 'cache', 'icons')
const output = path.join(root, 'assets', 'icons-pack.zip')

if (!fs.existsSync(source)) {
  console.error('Cache de ícones não encontrado: ' + source)
  process.exit(1)
}
const files = fs.readdirSync(source).filter(name => /^[0-9a-f]+\.png$/i.test(name))
console.log(files.length + ' PNGs em ' + source)
const entries = []
let index = 0, failed = 0
async function worker() {
  while (index < files.length) {
    const name = files[index++]
    try {
      const data = await sharp(path.join(source, name))
        .resize({ width: 256, withoutEnlargement: true })
        .webp({ quality: 78 }).toBuffer()
      entries.push([name.replace(/\.png$/i, '.webp'), data])
    } catch (error) {
      failed++
      console.warn('Ignorado ' + name + ': ' + error.message)
    }
    if (index % 500 === 0) console.log(index + '/' + files.length)
  }
}
await Promise.all(Array.from({ length: Math.max(1, os.cpus().length - 1) }, worker))
entries.sort((a, b) => a[0].localeCompare(b[0]))
fs.mkdirSync(path.dirname(output), { recursive: true })
writeZipStore(output, entries)
console.log(entries.length + ' ícones (' + failed + ' falhas) → ' + output +
  ' (' + (fs.statSync(output).size / 1048576).toFixed(1) + ' MB)')
