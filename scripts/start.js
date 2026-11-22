import { spawn } from 'node:child_process'
import electron from 'electron'

// Watch the renderer on disk during development. Both modes load the same local page.
const watch = process.argv.includes('--dev')
let watcher
if (watch) {
  const { build } = await import('vite')
  watcher = await build({ build: { watch: {} } })
  await new Promise((resolve, reject) => watcher.on('event', event => {
    if (event.code === 'END') resolve()
    if (event.code === 'ERROR') reject(event.error)
  }))
}
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electron, ['.'], { env, stdio: 'inherit' })
child.on('exit', async code => { await watcher?.close(); process.exitCode = code ?? 1 })
