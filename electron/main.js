import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { atomicWrite, detectDota } from '../core/install.js'
import { createPack, readPack } from '../core/packs.js'
import { equipSet } from '../core/selections.js'

const here = path.dirname(fileURLToPath(import.meta.url))
let root
let busy = false
let window
let cli, iconSession, catalog
const iconWorkers = new Set()
let progress = { phase: 'ocioso' }
function publishProgress(value) {
  progress = value
  if (window && !window.isDestroyed()) window.webContents.send('iconProgress', value)
}
function indexIcons() {
  if (!root || !catalog || !cli || iconSession?.indexing) return
  const images = new Set(Object.values(catalog.attributeIcons))
  for (const owner of [...catalog.heroes, catalog.global]) {
    for (const set of owner.sets || []) images.add(set.iconPath)
    for (const slot of owner.slots) {
      images.add(slot.defaultIconPath)
      for (const item of slot.items) images.add(item.image)
    }
  }
  const session = iconSession ??= createIconWorker()
  session.indexing = true
  publishProgress({ phase: 'verificando', done: 0 })
  void requestIcons(session, 'index', [...images].filter(Boolean)).finally(() => { session.indexing = false })
}
const dataPath = name => path.join(app.getPath('userData'), name)
const packFilters = [{ name: 'Predefinição de cosméticos (JSON)', extensions: ['json'] }]
function createIconWorker() {
  const worker = new Worker(new URL('./icon-worker.js', import.meta.url),
    { workerData: { root, cli, cache: dataPath('cache/icons') } })
  const session = { worker, pending: new Map(), next: 0 }
  iconWorkers.add(worker)
  worker.on('message', ({ id, result, progress }) => {
    if (progress) {
      if (session === iconSession) publishProgress(progress)
      return
    }
    session.pending.get(id)?.(result)
    session.pending.delete(id)
  })
  const close = () => {
    if (iconSession === session) {
      iconSession = null
      if (session.indexing) publishProgress({ phase: 'erro', message: 'O serviço de ícones terminou antes da conclusão.' })
    }
    for (const resolve of session.pending.values()) resolve({})
    session.pending.clear()
  }
  worker.on('error', close)
  worker.on('exit', () => { iconWorkers.delete(worker); close() })
  return session
}
function itemIcons(action, images) {
  if (!Array.isArray(images) || images.length > 8192 || images.some(image =>
    typeof image !== 'string' || image.length > 512)) {
    throw Error('Lote de ícones inválido.')
  }
  if (!root) return {}
  const session = iconSession ??= createIconWorker()
  return requestIcons(session, action, images)
}
function requestIcons(session, action, images) {
  const id = ++session.next
  return new Promise(resolve => {
    session.pending.set(id, resolve)
    session.worker.postMessage({ id, action, images })
  })
}
function resetIcons() {
  iconSession?.worker.postMessage({ action: 'close' })
  iconSession = null
  publishProgress({ phase: 'ocioso' })
}
function settings() {
  const file = path.join(app.getPath('userData'), 'presets.json')
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { version: 1, presets: [] }
}
function save(data) {
  atomicWrite(path.join(app.getPath('userData'), 'presets.json'), JSON.stringify(data, null, 2))
}
async function run(action, selections, force) {
  if (busy || !root) throw Error('Selecione a instalação e aguarde a operação atual.')
  busy = true
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./worker.js', import.meta.url), { workerData: { action, root, selections, force } })
      worker.once('error', reject)
      worker.once('exit', () => reject(Error('O processamento terminou sem resposta.')))
      worker.once('message', result => result.error
        ? reject(Object.assign(Error(result.error), { code: result.code }))
        : resolve(result.value))
    })
  } finally { busy = false }
}
function handlers() {
  async function diagnostic(action, selections, force) {
    let report
    try { report = await run(action, selections, force) }
    catch (e) { report = { root, ok: false, code: e.code, time: new Date().toISOString(), checks: [{ label: 'Operação interrompida', ok: false, detail: e.message }] } }
    atomicWrite(dataPath('diagnostics.json'), JSON.stringify(report, null, 2))
    return report
  }
  const actions = {
    init() {
      const data = settings()
      root = data.root && fs.existsSync(path.join(data.root, 'game/dota/pak01_dir.vpk')) ? data.root : detectDota()
      cli = data.decompiler || ''
      return { root, cli, presets: data.presets, store: dataPath('presets.json'), log: dataPath('diagnostics.json') }
    },
    async choose() {
      if (busy) throw Error('Aguarde o processamento.')
      const result = await dialog.showOpenDialog(window, { title: 'Selecione a pasta dota 2 beta', properties: ['openDirectory'] })
      if (result.canceled) return null
      const candidate = result.filePaths[0]
      if (!fs.existsSync(path.join(candidate, 'game/dota/pak01_dir.vpk'))) throw Error('A pasta precisa conter game/dota/pak01_dir.vpk.')
      save({ ...settings(), root: candidate })
      catalog = null
      root = candidate
      resetIcons()
      return root
    },
    async chooseCli() {
      const result = await dialog.showOpenDialog(window, { title: 'Selecione Decompiler.exe ou Source2Viewer-CLI.exe',
        filters: [{ name: 'ValveResourceFormat CLI', extensions: ['exe'] }], properties: ['openFile'] })
      if (result.canceled) return cli
      const candidate = result.filePaths[0]
      if (!/^(decompiler|source2viewer-cli)\.exe$/i.test(path.basename(candidate))) throw Error('Selecione o executável CLI do ValveResourceFormat.')
      save({ ...settings(), decompiler: candidate })
      cli = candidate
      resetIcons()
      indexIcons()
      return cli
    },
    cachedIcons: images => itemIcons('lookup', images),
    icons: images => itemIcons('get', images),
    indexIcons,
    equipSet: (choices, heroId, setId, styles) => equipSet(choices, catalog?.heroes.find(h => h.id === heroId), setId, styles),
    cacheStatus: () => progress,
    play: () => shell.openExternal('steam://rungameid/570'),
    async scan() {
      const result = await run('scan')
      catalog = result
      indexIcons()
      return catalog
    },
    apply: (selections, force) => diagnostic('apply', selections, force === true),
    diagnose: () => diagnostic('diagnose'),
    restore: () => run('restore'),
    async recover() {
      const result = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Cancelar', 'Restaurar backup'],
        defaultId: 0, cancelId: 0, message: 'Substituir gameinfo.gi pelo primeiro backup e limpar o mod?',
        detail: 'Uma cópia do gameinfo.gi atual será guardada com o sufixo .recovery-<id>. Um VPK alterado será preservado ao lado de dota_custom. O backup pode anteceder uma atualização do jogo.' })
      if (result.response !== 1) return false
      return { preserved: await run('recover') }
    },
    savePreset(name, selections) {
      const { name: packName, selections: entries } = createPack(name, selections)
      const data = settings()
      data.presets = [...data.presets.filter(p => p.name !== packName), { name: packName, selections: entries }]
      save(data)
      return data.presets
    },
    async exportPack(name, selections) {
      const pack = createPack(name, selections)
      const filename = pack.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '') || 'Predefinição de cosméticos'
      const result = await dialog.showSaveDialog(window, {
        title: 'Exportar predefinição', defaultPath: filename + '.json', filters: packFilters,
      })
      if (result.canceled) return false
      if (!/\.json$/i.test(result.filePath)) throw Error('Use a extensão .json para salvar a predefinição.')
      atomicWrite(result.filePath, JSON.stringify(pack, null, 2))
      return true
    },
    async importPack() {
      const result = await dialog.showOpenDialog(window, {
        title: 'Importar predefinição', filters: packFilters, properties: ['openFile'],
      })
      if (result.canceled) return null
      const file = await fs.promises.open(result.filePaths[0], 'r')
      let pack
      try {
        const stat = await file.stat()
        if (!stat.isFile() || stat.size > 4 * 1024 * 1024) throw Error('Arquivo de predefinição inválido ou maior que 4 MB.')
        pack = readPack(await file.readFile('utf8'))
      } finally { await file.close() }
      const data = settings()
      let name = pack.name
      let suffix = 1
      let existing = data.presets.find(p => p.name === name)
      while (existing && JSON.stringify(existing.selections) !== JSON.stringify(pack.selections)) {
        const ending = ' (' + ++suffix + ')'
        name = pack.name.slice(0, 80 - ending.length).trimEnd() + ending
        existing = data.presets.find(p => p.name === name)
      }
      const preset = existing || { name, selections: pack.selections }
      if (!existing) {
        data.presets.push(preset)
        save(data)
      }
      return { preset, presets: data.presets }
    },
  }
  for (const [name, fn] of Object.entries(actions)) ipcMain.handle(name, (event, ...args) => {
    if (event.senderFrame !== window.webContents.mainFrame) throw Error('Origem inválida.')
    return fn(...args)
  })
}
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { window?.restore(); window?.focus() })
  app.whenReady().then(() => {
    window = new BrowserWindow({
      width: 1370, height: 850, minWidth: 880, minHeight: 620, backgroundColor: '#101315',
      autoHideMenuBar: true, title: 'Dota 2 Local Skin Changer',
      webPreferences: { preload: path.join(here, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', e => e.preventDefault())
    handlers()
    window.loadFile(path.join(here, '../dist/index.html'))
  })
  app.on('before-quit', event => {
    if (!iconWorkers.size) return
    event.preventDefault()
    for (const worker of iconWorkers) {
      worker.once('exit', () => { if (!iconWorkers.size) app.quit() })
      worker.postMessage({ action: 'close' })
    }
  })
  app.on('window-all-closed', () => app.quit())
}
