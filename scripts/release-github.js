import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const { version, build: { artifactName: artifact } } = JSON.parse(readFileSync('package.json', 'utf8'))
const tag = `v${version}`
const requestedTag = process.argv[2]

if (requestedTag && requestedTag !== tag) {
  throw new Error(`A tag ${requestedTag} deve corresponder à versão do package.json (${tag}).`)
}

const gh = args => {
  const result = spawnSync('gh', args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

gh(['--version'])
await import('./build-exe.js')
gh(['release', 'create', tag, artifact, '--verify-tag', '--generate-notes'])
