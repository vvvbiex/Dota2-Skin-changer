import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { children, parseKV, scalar } from './kv1.js'
import { buildItemsVpk } from './vpk.js'
import { baseArchive, compareSchemas, consoleBaseline, readSchema, searchPaths } from './diagnostics.js'

const ARCHIVE = 'pak01_dir.vpk'
const RECEIPT = '.dota-local-skins.json'
const TAG = '// dota-local-skin-changer'
const BUILD_FILE = /^(?:pak01(?:_dir|_\d+)?\.vpk|\.local-skins-[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}\.tmp)$/i
const digest = data => createHash('sha256').update(data).digest('hex')
const exists = file => fs.lstatSync(file, { throwIfNoEntry: false })

export function detectDota() {
  const steam = new Set([...(process.env['ProgramFiles(x86)'] ? [path.join(process.env['ProgramFiles(x86)'], 'Steam')] : [])])
  try {
    const key = execFileSync('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
    const match = /SteamPath\s+REG_SZ\s+([^\r\n]+)/i.exec(key)
    if (match) steam.add(path.normalize(match[1].trim()))
  } catch { /* Steam can also be installed without this registry value. */ }
  const libraries = new Set(steam)
  for (const dir of steam) {
    const manifest = path.join(dir, 'steamapps', 'libraryfolders.vdf')
    if (!fs.existsSync(manifest)) continue
    for (const n of children(parseKV(fs.readFileSync(manifest, 'utf8'))[0])) {
      const library = scalar(children(n), 'path') || (/^\d+$/.test(n.key) && typeof n.value === 'string' && n.value)
      if (library) libraries.add(library)
    }
  }
  for (const dir of libraries) {
    const root = path.join(dir, 'steamapps', 'common', 'dota 2 beta')
    if (fs.existsSync(path.join(root, 'game', 'dota', ARCHIVE))) return root
  }
  return null
}

export function atomicWrite(file, data, stagingDir = path.dirname(file)) {
  const temp = path.join(stagingDir, '.local-skins-' + randomUUID() + '.tmp')
  try {
    fs.writeFileSync(temp, data, { flag: 'wx', flush: true })
    fs.renameSync(temp, file)
  } finally { fs.rmSync(temp, { force: true }) }
}

// Edit only the mount line owned by this application. Keep Steam's later edits.
export function editGameInfo(text, enable) {
  const paths = searchPaths(text)
  const edits = []
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  for (const node of paths.filter(n => n.dir === 'dota_custom')) {
    const start = text.lastIndexOf('\n', node.start - 1) + 1
    const lf = text.indexOf('\n', node.end)
    const end = lf < 0 ? text.length : lf + 1
    if (text.slice(start, node.start).trim() || text.slice(node.end, end).trim() !== TAG) {
      throw Error('A entrada dota_custom pertence a outra configuração.')
    }
    edits.push({ start, end, replacement: '' })
  }
  if (enable) for (const kind of ['game', 'mod']) {
    const base = paths.find(n => n.kind === kind && n.dir === 'dota' && !n.condition)
    if (!base && kind === 'mod') continue
    if (!base) throw Error('SearchPaths não contém Game dota.')
    const start = text.lastIndexOf('\n', base.start - 1) + 1
    const indent = text.slice(start, base.start)
    if (indent.trim()) throw Error('A entrada ' + base.key + ' dota precisa ocupar sua própria linha.')
    edits.push({ start, end: start, replacement: indent + base.key + '\t\t\t\tdota_custom ' + TAG + newline })
  }
  for (const e of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.replacement + text.slice(e.end)
  return text
}

function locations(root) {
  const game = path.join(fs.realpathSync(root), 'game')
  const dota = path.join(game, 'dota')
  const info = path.join(dota, 'gameinfo.gi')
  const dir = path.join(game, 'dota_custom')
  const backup = info + '.local-skins.bak'
  const archive = path.join(dir, ARCHIVE)
  const receipt = path.join(dir, RECEIPT)
  for (const p of [game, dota, dir, info, backup]) {
    if (exists(p)?.isSymbolicLink()) throw Error('Caminho de instalação redirecionado: ' + p)
  }
  return { dir, info, backup, archive, receipt }
}

function inspectMod(files, recover = false) {
  if (!exists(files.dir)) return null
  if (!exists(files.receipt)) throw Error('A pasta dota_custom já existe e pertence a outra instalação.')
  if (!exists(files.receipt)?.isFile() || (exists(files.archive) && !exists(files.archive).isFile())) {
    throw Error('A pasta dota_custom contém outros arquivos. A operação foi interrompida.')
  }
  const record = JSON.parse(fs.readFileSync(files.receipt, 'utf8'))
  if (record.app !== 'dota-local-skins' || !Array.isArray(record.hashes)) throw Error('Registro do mod inválido.')
  if (fs.readdirSync(files.dir).some(name => ![ARCHIVE, RECEIPT].includes(name))) {
    throw Error('A pasta dota_custom contém outros arquivos. A operação foi interrompida.')
  }
  if (exists(files.archive)) {
    const hash = digest(fs.readFileSync(files.archive))
    if (!record.hashes.includes(hash)) {
      if (recover) return 'modified'
      throw Error('O VPK local foi alterado fora do aplicativo. A recuperação pelo backup permite guardá-lo à parte.')
    }
    return hash
  }
  return ''
}

function commitInfo(file, original, updated) {
  if (original === updated) return
  if (fs.readFileSync(file, 'utf8') !== original) throw Error('gameinfo.gi mudou durante a operação. Tente novamente.')
  atomicWrite(file, updated)
}

function clearMod(files) {
  fs.rmSync(files.archive, { force: true })
  fs.unlinkSync(files.receipt)
  fs.rmdirSync(files.dir)
}

export function installMod(root, patchedText, options) {
  return installModWithReport(root, patchedText, options).archive
}

export function installModWithReport(root, patchedText, { originalSchema = readSchema(baseArchive(root)), affected, force = false } = {}) {
  const validated = compareSchemas(originalSchema, patchedText, affected)
  const files = locations(root)
  const current = exists(files.dir)
  const contents = current?.isDirectory() ? fs.readdirSync(files.dir, { withFileTypes: true }) : []
  const known = entry => entry.isFile() && (entry.name.toLowerCase() === RECEIPT || BUILD_FILE.test(entry.name))
  const blocked = (current && !current.isDirectory()) || contents.some(entry => !known(entry))
  if (blocked && !force) {
    throw Object.assign(Error('A pasta dota_custom contém outros arquivos. A operação foi interrompida.'), { code: 'CUSTOM_DIR_CONTENTS' })
  }
  const original = fs.readFileSync(files.info, 'utf8')
  const updated = editGameInfo(original, true)
  const existing = current && !blocked
  if (existing) for (const entry of contents) {
    if (![ARCHIVE, RECEIPT].includes(entry.name.toLowerCase())) fs.unlinkSync(path.join(files.dir, entry.name))
  }
  const rollback = existing && exists(files.archive) ? fs.readFileSync(files.archive) : null
  const oldReceipt = existing && exists(files.receipt) ? fs.readFileSync(files.receipt) : null
  const prior = rollback ? digest(rollback) : null
  const data = buildItemsVpk(patchedText)
  const hash = digest(data)
  const parent = path.dirname(files.dir)
  if (!exists(files.backup)) fs.copyFileSync(files.info, files.backup, fs.constants.COPYFILE_EXCL)
  // Keep both hashes so a stopped update can be retried either side of the rename.
  let baseline
  try { baseline = consoleBaseline(root) } catch { /* Optional evidence when the client permits shared log reads. */ }
  const receipt = JSON.stringify({ app: 'dota-local-skins', source: digest(originalSchema), affected: validated.changed, console: baseline,
    hashes: [...new Set([prior, hash].filter(Boolean))] })
  let preserved, staging, installed = false
  try {
    if (existing) {
      atomicWrite(files.receipt, receipt, parent)
      if (prior !== hash) atomicWrite(files.archive, data, parent)
    } else {
      staging = fs.mkdtempSync(files.dir + '.stage-')
      fs.writeFileSync(path.join(staging, RECEIPT), receipt)
      fs.writeFileSync(path.join(staging, ARCHIVE), data, { flush: true })
      if (blocked) {
        const destination = files.dir + '.backup-' + randomUUID()
        fs.renameSync(files.dir, destination)
        preserved = destination
      }
      fs.renameSync(staging, files.dir)
      installed = true
    }
    if (readSchema(files.archive) !== patchedText) throw Error('O conteúdo relido do VPK diverge do patch.')
    commitInfo(files.info, original, updated)
    if (fs.readFileSync(files.info, 'utf8') !== updated) throw Error('gameinfo.gi mudou após a gravação.')
  }
  catch (error) {
    if (existing) {
      if (rollback && prior !== hash) atomicWrite(files.archive, rollback, parent)
      if (!rollback) fs.rmSync(files.archive, { force: true })
      if (oldReceipt) atomicWrite(files.receipt, oldReceipt, parent)
      else fs.rmSync(files.receipt, { force: true })
    }
    if (installed) clearMod(files)
    if (preserved) fs.renameSync(preserved, files.dir)
    throw error
  } finally {
    if (staging && exists(staging)) {
      for (const name of [RECEIPT, ARCHIVE]) fs.rmSync(path.join(staging, name), { force: true })
      fs.rmdirSync(staging)
    }
  }
  return { archive: files.archive, preserved }
}

export function restoreGame(root, recoverBackup = false) {
  const files = locations(root)
  const prior = inspectMod(files, recoverBackup)
  let preserved
  if (recoverBackup) {
    const backup = fs.readFileSync(files.backup, 'utf8')
    editGameInfo(backup, true) // validate the backup before replacing anything
    if (exists(files.info)) fs.copyFileSync(files.info, files.info + '.recovery-' + randomUUID(), fs.constants.COPYFILE_EXCL)
    atomicWrite(files.info, editGameInfo(backup, false))
    if (prior === 'modified') {
      preserved = path.join(path.dirname(files.dir), 'dota_custom.recovery-' + randomUUID() + '.vpk')
      fs.renameSync(files.archive, preserved)
    }
  } else {
    const original = fs.readFileSync(files.info, 'utf8')
    commitInfo(files.info, original, editGameInfo(original, false))
  }
  if (prior !== null) clearMod(files)
  return preserved
}
