import { parentPort, workerData } from 'node:worker_threads'
import { loadGame } from '../core/catalog.js'
import { patchItemsGame } from '../core/patch.js'
import { installModWithReport, restoreGame } from '../core/install.js'
import { diagnose } from '../core/diagnostics.js'
import fs from 'node:fs'
import path from 'node:path'

try {
  const { action, root, selections, force } = workerData
  let value
  if (action === 'restore' || action === 'recover') value = restoreGame(root, action === 'recover')
  else if (action === 'diagnose') value = diagnose(root)
  else {
    const schema = loadGame(root)
    if (action === 'scan') value = schema.catalog
    else if (action === 'apply') {
      if (!selections?.length) throw Error('Selecione ao menos um item.')
      const affected = new Set()
      const info = path.join(root, 'game/dota/gameinfo.gi')
      const before = fs.readFileSync(info, 'utf8')
      const patched = patchItemsGame(schema, selections, affected)
      const { preserved } = installModWithReport(root, patched, { originalSchema: schema.text, affected, force })
      value = diagnose(root)
      value.preserved = preserved
      value.gameInfoChanged = before !== fs.readFileSync(info, 'utf8')
      value.selections = selections
    } else throw Error('Operação inválida.')
  }
  parentPort.postMessage({ value })
} catch (error) { parentPort.postMessage({ error: error.message, code: error.code }) }
