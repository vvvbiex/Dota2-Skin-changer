import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { setImmediate as yieldWorker } from 'node:timers/promises'
import { attributeIcons } from './catalog.js'
import { promisify } from 'node:util'
import { baseArchive, sha } from './diagnostics.js'
import { atomicWrite } from './install.js'
import { openVpk } from './vpk.js'

const signature = Buffer.from('89504e470d0a1a0a', 'hex')
const execute = promisify(execFile)
const missingCli = { reason: 'Configure o CLI do ValveResourceFormat para gerar este ícone.' }
const failedConversion = { reason: 'O CLI não produziu um PNG válido para esta textura.' }
function png(file) {
  if (!fs.existsSync(file) || fs.statSync(file).size > 16 * 1024 * 1024) return null
  const bytes = fs.readFileSync(file)
  return bytes.length >= 33 && bytes.subarray(0, 8).equals(signature) &&
    bytes.toString('ascii', 12, 16) === 'IHDR' &&
    bytes.subarray(-8, -4).toString() === 'IEND' ? bytes : null
}

export function createIconReader(root, cache, cli, signal) {
  const archive = baseArchive(root)
  let pack, stamp
  const pending = new Map()
  const attributes = new Set(Object.values(attributeIcons))
  let indexing
  function archiveIndex() {
    const stat = fs.statSync(archive)
    const key = stat.size + ':' + stat.mtimeMs
    if (key !== stamp) {
      pack = openVpk(archive, p => p.endsWith('.vtex_c') && p.startsWith('panorama/images/'))
      stamp = key
    }
    return pack
  }
  function resource(entry, image) {
    const file = path.join(cache, sha(entry + ':' + pack.checksum(entry)) + '.png')
    return { entry, file, image }
  }
  function resources(images) {
    archiveIndex()
    return [...new Set(images)].map(image => {
      if (!/^(?:[\w. -]+\/)+[\w. -]+$/.test(image) || image.split('/').some(part => /^[. ]+$/.test(part))) {
        return { image, result: {} }
      }
      const base = 'panorama/images/' + image.toLowerCase().replace(/\.(png|vtex_c)$/, '')
      const entry = [base + '_png.vtex_c', base + '.vtex_c'].find(p => pack.has(p))
      if (!entry) return { image, result: { reason: 'Textura ausente no VPK.' } }
      return resource(entry, image)
    })
  }
  function cached(file) {
    const data = png(file)
    return data && { url: 'data:image/png;base64,' + data.toString('base64') }
  }
  async function convert(entries, source, report) {
    if (!entries.length || signal?.aborted) return
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-icon-'))
    try {
      const input = path.join(dir, 'input'), output = path.join(dir, 'output')
      fs.mkdirSync(input)
      fs.mkdirSync(output)
      fs.mkdirSync(cache, { recursive: true })
      for (const [index, { entry, file }] of entries.entries()) {
        if (signal?.aborted) return
        fs.writeFileSync(path.join(input, path.basename(file, '.png') + '.vtex_c'), source.read(entry))
        if (index % 32 === 0) {
          report?.('preparando', index + 1, entries.length)
          await yieldWorker()
        }
      }
      report?.('convertendo', 0, entries.length)
      const outputs = new Map(entries.map(({ file }) => [path.basename(file), file]))
      const total = outputs.size
      function publish(name) {
        const file = outputs.get(name)
        if (!file) return
        const produced = path.join(output, name)
        const data = png(produced)
        if (!data) return
        try { fs.renameSync(produced, file) }
        catch (error) {
          if (error.code !== 'EXDEV') throw error
          atomicWrite(file, data)
        }
        outputs.delete(name)
      }
      // Publish complete PNGs while the one recursive CLI process is still running.
      let failure
      const timer = report && setInterval(() => {
        if (failure || signal?.aborted) return
        try {
          let copied = 0
          for (const name of fs.readdirSync(output)) {
            if (!outputs.has(name)) continue
            publish(name)
            if (++copied === 32) break
          }
          report('convertendo', total - outputs.size, total)
        } catch (error) { failure = error }
      }, 500)
      try {
        await execute(cli, ['-i', input, '-o', output, '-d', '--threads', '4', '--quiet', '--recursive'],
          { cwd: dir, windowsHide: true, maxBuffer: 1024 * 1024, signal, timeout: report ? 0 : 120000 })
      } catch (error) { failure = error }
      finally { clearInterval(timer) }
      let checked = 0
      for (const name of outputs.keys()) {
        if (signal?.aborted) return
        publish(name)
        if (++checked % 32 === 0) {
          report?.('salvando', total - outputs.size, total)
          await yieldWorker()
        }
      }
      if (outputs.size) throw Error(failure?.message || outputs.size + ' ícone(s) sem PNG válido.')
    } finally { await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 3 }) }
  }
  async function index(images, report) {
    const source = archiveIndex()
    const entries = new Map()
    for (const entry of source.paths()) {
      if (/^panorama\/images\/econ\/(items|default_items)\//.test(entry)) entries.set(entry, resource(entry))
    }
    for (const icon of resources([...images, ...attributes])) if (icon.entry) entries.set(icon.entry, icon)
    const missing = []
    let checked = 0
    for (const icon of entries.values()) {
      if (signal?.aborted) return
      if (!png(icon.file)) missing.push(icon)
      if (++checked % 64 === 0) {
        report('verificando', checked, entries.size)
        await yieldWorker()
      }
    }
    if (missing.length && (!cli || !fs.existsSync(cli))) throw Error(missingCli.reason)
    await convert(missing, source, report)
    if (!signal?.aborted) report('concluído', entries.size, entries.size)
  }
  return {
    index(images, report) {
      return indexing ??= index(images, report).finally(() => { indexing = null })
    },
    lookup(images) {
      return Object.fromEntries(resources(images).flatMap(({ image, result, file }) => {
        const found = result ?? cached(file)
        return found ? [[image, found]] : []
      }))
    },
    async get(images) {
      const list = resources(images)
      for (const icon of list) icon.result ??= cached(icon.file)
      const missing = new Map(list.filter(icon => !icon.result && !pending.has(icon.file)).map(icon => [icon.file, icon]))
      if (missing.size && cli && fs.existsSync(cli)) {
        const job = convert([...missing.values()], pack).catch(() => {}).finally(() => {
          for (const file of missing.keys()) pending.delete(file)
        })
        for (const file of missing.keys()) pending.set(file, job)
      }
      return Object.fromEntries(await Promise.all(list.map(async ({ image, result, file }) => {
        if (result) return [image, result]
        const job = pending.get(file)
        if (!job) return [image, missingCli]
        await job
        return [image, cached(file) || failedConversion]
      })))
    }
  }
}
