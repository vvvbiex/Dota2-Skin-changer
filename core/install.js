import fs from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
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
  const branch = path.join(dota, 'gameinfo_branchspecific.gi')
  return { dir, info, backup, archive, receipt, branch, branchBackup: branch + '.local-skins.bak' }
}

// O Dota monta SearchPaths a partir de gameinfo_branchspecific.gi quando ele declara essa seção
// (observado no console.log: dota_custom do gameinfo.gi era ignorado). Edita também esse arquivo.
function branchPlan(files, enable) {
  if (!exists(files.branch)?.isFile()) return null
  const text = fs.readFileSync(files.branch, 'utf8')
  try {
    if (!searchPaths(text).some(n => n.kind === 'game' && n.dir === 'dota' && !n.condition)) return null
  } catch { return null }
  return { text, updated: editGameInfo(text, enable) }
}

function verifyMountOrder(text, label) {
  const order = searchPaths(text)
  const customAt = order.findIndex(n => n.kind === 'game' && n.dir === 'dota_custom')
  const baseAt = order.findIndex(n => n.kind === 'game' && n.dir === 'dota' && !n.condition)
  if (customAt < 0 || (baseAt >= 0 && customAt > baseAt)) {
    throw Error(label + ': Game dota_custom não está acima de Game dota em SearchPaths.')
  }
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

const lockErrors = new Set(['EPERM', 'EACCES', 'EBUSY'])

async function retryWrite(file, operation) {
  for (let attempt = 0; ; attempt++) {
    try { return await operation() } catch (cause) {
      if (!lockErrors.has(cause.code)) throw cause
      if (attempt === 4) throw Object.assign(new Error(
        'O Windows bloqueou a gravação em ' + file + '. Feche o Dota 2, aguarde a sincronização e confira a permissão de escrita da pasta.', { cause }), { code: cause.code })
      await setTimeout(100 * (attempt + 1))
    }
  }
}

async function writable(file) {
  const stat = await fs.promises.lstat(file).catch(error => {
    if (error.code !== 'ENOENT') throw error
  })
  if (stat?.isSymbolicLink()) throw Error('Caminho de instalação redirecionado: ' + file)
  if (stat && !(stat.mode & 0o200)) await fs.promises.chmod(file, stat.mode | 0o200)
}

async function removeFile(file, directory = false) {
  await retryWrite(file, async () => {
    await writable(file)
    if (directory) await fs.promises.rmdir(file)
    else await fs.promises.rm(file, { force: true })
  })
}

async function moveFile(source, destination, beforeRename) {
  await retryWrite(destination, async () => {
    await writable(source)
    await writable(destination)
    if (beforeRename) await beforeRename()
    await fs.promises.rename(source, destination)
  })
}

async function replaceFile(file, data, beforeRename) {
  const temp = path.join(path.dirname(file), '.local-skins-' + randomUUID() + '.tmp')
  try {
    await retryWrite(temp, () => fs.promises.writeFile(temp, data, { flag: 'wx', flush: true }))
    await moveFile(temp, file, beforeRename)
  } finally { await removeFile(temp) }
}

async function copyBackup(source, destination) {
  await retryWrite(destination, () => fs.promises.copyFile(source, destination, fs.constants.COPYFILE_EXCL))
}

async function commitInfo(file, original, updated) {
  if (original === updated) return
  await replaceFile(file, updated, async () => {
    if (await fs.promises.readFile(file, 'utf8') !== original) throw Error('gameinfo.gi mudou durante a operação. Tente novamente.')
  })
}

async function clearMod(files) {
  await removeFile(files.archive)
  const receipt = await fs.promises.readFile(files.receipt)
  await removeFile(files.receipt)
  try { await removeFile(files.dir, true) } catch (error) {
    await replaceFile(files.receipt, receipt)
    throw error
  }
}

export async function installMod(root, patchedText, options) {
  return (await installModWithReport(root, patchedText, options)).archive
}

export async function installModWithReport(root, patchedText, { originalSchema = readSchema(baseArchive(root)), affected, force = false } = {}) {
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
  const branch = branchPlan(files, true)
  const existing = current && !blocked
  if (current?.isDirectory()) await retryWrite(files.dir, () => writable(files.dir))
  if (existing) for (const entry of contents) {
    if (![ARCHIVE, RECEIPT].includes(entry.name.toLowerCase())) await removeFile(path.join(files.dir, entry.name))
  }
  const rollback = existing && exists(files.archive) ? fs.readFileSync(files.archive) : null
  const oldReceipt = existing && exists(files.receipt) ? fs.readFileSync(files.receipt) : null
  const prior = rollback ? digest(rollback) : null
  const data = buildItemsVpk(patchedText)
  const hash = digest(data)
  if (!exists(files.backup)) await copyBackup(files.info, files.backup)
  if (branch && !exists(files.branchBackup)) await copyBackup(files.branch, files.branchBackup)
  // Keep both hashes so a stopped update can be retried either side of the rename.
  let baseline
  try { baseline = consoleBaseline(root) } catch { /* Optional evidence when the client permits shared log reads. */ }
  const receipt = JSON.stringify({ app: 'dota-local-skins', source: digest(originalSchema), affected: validated.changed, console: baseline,
    hashes: [...new Set([prior, hash].filter(Boolean))] })
  const movedEntries = []
  let preserved, created = false, receiptWritten = false, archiveWritten = false, branchWritten = false
  try {
    if (blocked) {
      const destination = files.dir + '.backup-' + randomUUID()
      if (current.isDirectory()) {
        await retryWrite(destination, () => fs.promises.mkdir(destination))
        preserved = destination
        for (const { name } of contents) {
          await moveFile(path.join(files.dir, name), path.join(destination, name))
          movedEntries.push(name)
        }
      } else {
        await moveFile(files.dir, destination)
        preserved = destination
      }
    }
    if (!current?.isDirectory()) {
      await retryWrite(files.dir, () => fs.promises.mkdir(files.dir))
      created = true
    }
    await replaceFile(files.receipt, receipt)
    receiptWritten = true
    const startedAt = Date.now() - 2000
    const before = exists(files.archive)
    {
      await replaceFile(files.archive, data)
      archiveWritten = true
    }
    const after = fs.statSync(files.archive)
    if (after.size !== data.length || digest(fs.readFileSync(files.archive)) !== hash) {
      throw Error('pak01_dir.vpk não foi substituído: tamanho ou hash divergem do pacote gerado.')
    }
    if (after.mtimeMs < startedAt || (before && after.mtimeMs < before.mtimeMs)) {
      throw Error('pak01_dir.vpk não foi atualizado: a data de modificação permaneceu antiga.')
    }
    if (readSchema(files.archive) !== patchedText) throw Error('O conteúdo relido do VPK diverge do patch.')
    if (branch) {
      branchWritten = true
      await commitInfo(files.branch, branch.text, branch.updated)
      const writtenBranch = fs.readFileSync(files.branch, 'utf8')
      if (writtenBranch !== branch.updated) throw Error('gameinfo_branchspecific.gi mudou após a gravação.')
      verifyMountOrder(writtenBranch, 'gameinfo_branchspecific.gi')
    }
    await commitInfo(files.info, original, updated)
    const written = fs.readFileSync(files.info, 'utf8')
    if (written !== updated) throw Error('gameinfo.gi mudou após a gravação.')
    const order = searchPaths(written)
    const customAt = order.findIndex(n => n.kind === 'game' && n.dir === 'dota_custom')
    const baseAt = order.findIndex(n => n.kind === 'game' && n.dir === 'dota' && !n.condition)
    if (customAt < 0 || (baseAt >= 0 && customAt > baseAt)) {
      throw Error('gameinfo.gi: Game dota_custom não está acima de Game dota em SearchPaths.')
    }
  }
  catch (error) {
    try {
      if (branchWritten) await replaceFile(files.branch, branch.text)
      if (archiveWritten) {
        if (rollback) await replaceFile(files.archive, rollback)
        else await removeFile(files.archive)
      }
      if (receiptWritten) {
        if (oldReceipt) await replaceFile(files.receipt, oldReceipt)
        else await removeFile(files.receipt)
      }
      if (created) await removeFile(files.dir, true)
      if (preserved && current.isDirectory()) {
        for (const name of movedEntries.reverse()) {
          await moveFile(path.join(preserved, name), path.join(files.dir, name))
        }
        await removeFile(preserved, true)
      } else if (preserved) await moveFile(preserved, files.dir)
    } catch (recoveryError) {
      throw Error(error.message + ' Falha ao reverter: ' + recoveryError.message + (preserved ? ' Backup em ' + preserved : ''))
    }
    throw error
  }
  return { archive: files.archive, preserved }
}

export async function restoreGame(root, recoverBackup = false) {
  const files = locations(root)
  const prior = inspectMod(files, recoverBackup)
  let preserved
  if (recoverBackup) {
    const backup = fs.readFileSync(files.backup, 'utf8')
    editGameInfo(backup, true) // validate the backup before replacing anything
    if (exists(files.info)) await copyBackup(files.info, files.info + '.recovery-' + randomUUID())
    await replaceFile(files.info, editGameInfo(backup, false))
    if (prior === 'modified') {
      preserved = path.join(path.dirname(files.dir), 'dota_custom.recovery-' + randomUUID() + '.vpk')
      await moveFile(files.archive, preserved)
    }
  } else {
    const original = fs.readFileSync(files.info, 'utf8')
    await commitInfo(files.info, original, editGameInfo(original, false))
  }
  if (prior !== null) await clearMod(files)
  const branch = branchPlan(files, false)
  if (branch && branch.text !== branch.updated) await commitInfo(files.branch, branch.text, branch.updated)
  return preserved
}
