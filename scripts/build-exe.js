import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { Arch, build, Platform } from 'electron-builder'
import { build as buildRenderer } from 'vite'

const releaseDir = 'release'
const lockDir = '.build-exe.lock'
const artifact = 'Dota 2 Local Skin Changer.exe'
const stagedArtifact = join(releaseDir, artifact)
const retryOptions = { maxRetries: 5, retryDelay: 200 }
const transientErrors = new Set(['EACCES', 'EBUSY', 'EPERM'])

try {
  await mkdir(lockDir)
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  throw new Error('Outro build está usando release/. Se o processo foi interrompido, remova .build-exe.lock/ antes de tentar novamente.')
}

try {
  await buildRenderer()
  await build({ targets: Platform.WINDOWS.createTarget(['portable'], Arch.x64), publish: 'never' })

  // Keep the previous executable in place until Windows accepts the replacement.
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(stagedArtifact, artifact)
      break
    } catch (error) {
      if (attempt >= retryOptions.maxRetries || !transientErrors.has(error.code)) throw error
      await setTimeout(retryOptions.retryDelay * (attempt + 1))
    }
  }

  await rm(releaseDir, { recursive: true, force: true, ...retryOptions })
} finally {
  await rm(lockDir, { recursive: true, force: true, ...retryOptions })
}

console.log(`Executável portátil disponível na raiz: ${artifact}`)
