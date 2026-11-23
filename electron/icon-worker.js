import { parentPort, workerData } from 'node:worker_threads'
import { createIconReader } from '../core/icons.js'

const controller = new AbortController()
const icons = createIconReader(workerData.root, workerData.cache, workerData.cli, controller.signal, workerData.pack)
parentPort.on('message', async ({ id, action, images }) => {
  if (action === 'close') {
    controller.abort()
    parentPort.close()
    return
  }
  try {
    const result = action === 'index'
      ? await icons.index(images, (phase, done, total) => parentPort.postMessage({ progress: { phase, done, total } }))
      : await icons[action](images)
    parentPort.postMessage({ id, result })
  } catch (error) {
    if (action === 'index') parentPort.postMessage({ progress: { phase: 'erro', message: error.message } })
    parentPort.postMessage({ id, result: {} })
  }
})
