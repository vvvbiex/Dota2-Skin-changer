import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { parseKV, children } from './kv1.js'
import { openVpk, ITEMS_PATH } from './vpk.js'

export const sha = data => createHash('sha256').update(data).digest('hex')
export const baseArchive = root => path.join(root, 'game/dota/pak01_dir.vpk')
export const readSchema = file => openVpk(file, p => p === ITEMS_PATH).read(ITEMS_PATH).toString('utf8')
const consolePath = root => path.join(root, 'game/dota/console.log')

// Anchor evidence to the byte boundary at apply time, including truncated/recreated logs.
export function consoleBaseline(root) {
  const file = consolePath(root)
  const stat = fs.statSync(file, { throwIfNoEntry: false })
  if (!stat) return { size: 0 }
  const fd = fs.openSync(file, 'r')
  try {
    const tail = Buffer.alloc(Math.min(128, stat.size))
    fs.readSync(fd, tail, 0, tail.length, stat.size - tail.length)
    return { size: stat.size, birth: stat.birthtimeMs, tail: sha(tail) }
  } finally { fs.closeSync(fd) }
}

function clientEvidence(root, baseline) {
  if (!baseline) return 'Aplicação anterior sem referência temporal. Reaplique para acompanhar o console do cliente.'
  const file = consolePath(root)
  const stat = fs.statSync(file, { throwIfNoEntry: false })
  if (!stat) return 'Sem console.log. A montagem e a aparência no cliente ainda não foram confirmadas.'
  const fd = fs.openSync(file, 'r')
  try {
    let start = 0
    if (baseline.birth === stat.birthtimeMs && baseline.size <= stat.size && baseline.size) {
      const tail = Buffer.alloc(Math.min(128, baseline.size))
      fs.readSync(fd, tail, 0, tail.length, baseline.size - tail.length)
      if (sha(tail) === baseline.tail) start = baseline.size
    }
    start = Math.max(start, stat.size - 2 * 1024 * 1024)
    const buffer = Buffer.alloc(stat.size - start)
    fs.readSync(fd, buffer, 0, buffer.length, start)
    const lines = buffer.toString('utf8').replaceAll('\\', '/').split(/\r?\n/).filter(l => /dota_custom\/pak01_dir\.vpk/i.test(l))
    if (lines.some(l => /fail|error|invalid|reject|unable|couldn.t/i.test(l))) return 'O console menciona uma falha no VPK local. Consulte game/dota/console.log.'
    if (lines.some(l => /\b(?:mounted|loaded|added)\b|\b(?:GAME|MOD)\s+["a-zA-Z]/i.test(l))) return 'O console do cliente registrou o VPK local na montagem. A leitura específica de items_game.txt e a aparência ainda dependem de verificação no jogo.'
    return 'Sem registro de montagem do VPK local nos últimos 2 MiB do console desde a aplicação.'
  } finally { fs.closeSync(fd) }
}

function structure(text) {
  const doc = parseKV(text)
  if (doc.length !== 1 || doc[0].key !== 'items_game') throw Error('Raiz items_game inválida.')
  const sections = children(doc[0])
  const items = sections.filter(n => n.key === 'items')
  if (items.length !== 1 || !children(items[0]).length) throw Error('Seção items ausente, vazia ou duplicada.')
  const defs = new Map()
  for (const n of children(items[0])) {
    if (defs.has(n.key)) throw Error('Definição duplicada: ' + n.key)
    defs.set(n.key, text.slice(n.start, n.end))
  }
  return { defs, names: sections.map(n => n.key), other: sections.filter(n => n.key !== 'items').map(n => text.slice(n.start, n.end)) }
}

export function compareSchemas(original, modified, allowed) {
  const a = structure(original), b = structure(modified)
  if (JSON.stringify(a.names) !== JSON.stringify(b.names) || a.other.some((s, i) => s !== b.other[i])) {
    throw Error('Seções externas a items mudaram. Reaplique a partir do VPK atual.')
  }
  for (const id of a.defs.keys()) if (!b.defs.has(id)) throw Error('Definição perdida: ' + id)
  const changed = [...b.defs.keys()].filter(id => b.defs.get(id) !== a.defs.get(id))
  if (allowed && changed.some(id => !allowed.has(id))) throw Error('O patch alterou itens fora da seleção.')
  return { originalBytes: Buffer.byteLength(original), modifiedBytes: Buffer.byteLength(modified),
    sections: a.names.length, items: b.defs.size, changed }
}

export function searchPaths(text) {
  let nodes = parseKV(text)
  for (const key of ['gameinfo', 'filesystem', 'searchpaths']) {
    const matches = nodes.filter(n => n.key.toLowerCase() === key)
    if (matches.length !== 1) throw Error('Seção ausente ou ambígua: ' + key)
    nodes = children(matches[0])
  }
  return nodes.filter(n => ['game', 'mod'].includes(n.key.toLowerCase()) && typeof n.value === 'string')
    .map(n => ({ ...n, kind: n.key.toLowerCase(), dir: n.value.toLowerCase(), line: text.slice(0, n.start).split('\n').length }))
}

export function diagnose(root) {
  const info = path.join(root, 'game/dota/gameinfo.gi')
  const archive = path.join(root, 'game/dota_custom/pak01_dir.vpk')
  const report = { time: new Date().toISOString(), root, info, archive, checks: [], ok: true }
  function check(label, fn) {
    try { report.checks.push({ label, ok: true, detail: fn() }) }
    catch (e) { report.ok = false; report.checks.push({ label, ok: false, detail: e.message }) }
  }
  check('FileSystem / SearchPaths', () => {
    const rows = searchPaths(fs.readFileSync(info, 'utf8'))
    const details = []
    for (const kind of ['game', 'mod']) {
      const base = rows.find(n => n.kind === kind && n.dir === 'dota' && !n.condition)
      const mounts = rows.filter(n => n.kind === kind && n.dir === 'dota_custom')
      if (!base && kind === 'mod' && !mounts.length) continue
      if (!base || mounts.length !== 1 || mounts[0].condition || mounts[0].start > base.start) {
        throw Error([...details, kind + ': montagem ausente, condicional, duplicada ou fora de ordem. Verifique se o jogo atualizou gameinfo.gi.'].join('\n'))
      }
      details.push(kind + ' dota_custom na linha ' + mounts[0].line + ' → ' + kind + ' dota na linha ' + base.line)
    }
    return details.join('\n')
  })
  let modified
  let receipt
  check('VPK instalado', () => {
    const pack = openVpk(archive)
    modified = pack.read(ITEMS_PATH).toString('utf8')
    receipt = JSON.parse(fs.readFileSync(path.join(path.dirname(archive), '.dota-local-skins.json'), 'utf8'))
    const hash = sha(fs.readFileSync(archive))
    if (!receipt.hashes?.includes(hash)) throw Error('SHA-256 diverge do registro de instalação.')
    return 'VPK v' + pack.version + ' · ' + ITEMS_PATH + ' · CRC32 válido · SHA-256 ' + hash
  })
  check('Sintaxe, tamanho e escopo do KV1', () => {
    if (modified === undefined) throw Error('Não foi possível extrair items_game.txt do VPK local.')
    const original = readSchema(baseArchive(root))
    if (receipt?.source && sha(original) !== receipt.source) throw Error('O esquema original mudou desde a aplicação. Reaplique o preset.')
    const d = compareSchemas(original, modified, receipt?.affected ? new Set(receipt.affected) : undefined)
    return d.originalBytes + ' → ' + d.modifiedBytes + ' bytes · ' + d.sections + ' seções · ' + d.items +
      ' definições · IDs alterados: ' + (d.changed.join(', ') || 'nenhum')
  })
  check('gameinfo_branchspecific.gi', () => {
    const file = path.join(path.dirname(info), 'gameinfo_branchspecific.gi')
    if (!fs.existsSync(file)) return 'Arquivo ausente: não participa do SearchPaths.'
    let rows
    try { rows = searchPaths(fs.readFileSync(file, 'utf8')) } catch { return 'Sem SearchPaths: não participa da montagem.' }
    const base = rows.findIndex(n => n.kind === 'game' && n.dir === 'dota' && !n.condition)
    if (base < 0) return 'Sem Game dota: não participa da montagem.'
    const custom = rows.findIndex(n => n.kind === 'game' && n.dir === 'dota_custom')
    if (custom < 0 || custom > base) throw Error('gameinfo_branchspecific.gi define SearchPaths sem Game dota_custom acima de Game dota. O Dota ignora o mod. Reaplique.')
    return 'Game dota_custom acima de Game dota.'
  })
  try { report.client = clientEvidence(root, receipt?.console) }
  catch (e) { report.client = 'Console indisponível para leitura: ' + e.message }
  return report
}
