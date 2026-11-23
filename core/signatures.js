import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { crc32 } from 'node:zlib'
import { execFileSync } from 'node:child_process'

// Formato real de game/bin/win64/dota.signatures (confirmado no arquivo da Steam):
//   ...\..\..\dota\gameinfo.gi~SHA1:<40 HEX>;CRC:<8 HEX>
// seguido de um bloco DIGEST:<hex>. O arquivo é ASCII com CRLF.
export const SIGNED_FILES = ['gameinfo.gi', 'gameinfo_branchspecific.gi']
const PREFIX = '...\\..\\..\\dota\\'

export const signaturesFile = root => path.join(root, 'game', 'bin', 'win64', 'dota.signatures')
export const signaturesBackup = root => signaturesFile(root) + '.local-skins.bak'
export const signaturesReceipt = root => signaturesFile(root) + '.local-skins.json'

export function fileSignature(data) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
  return {
    sha1: createHash('sha1').update(buffer).digest('hex').toUpperCase(),
    crc: crc32(buffer).toString(16).toUpperCase().padStart(8, '0'),
  }
}

export const signatureLine = (name, { sha1, crc }) => PREFIX + name + '~SHA1:' + sha1 + ';CRC:' + crc

export function expectedSignatures(root) {
  const dota = path.join(root, 'game', 'dota')
  return SIGNED_FILES.filter(name => fs.existsSync(path.join(dota, name))).map(name =>
    ({ name, line: signatureLine(name, fileSignature(fs.readFileSync(path.join(dota, name)))) }))
}

const lines = text => text.split(/\r?\n/)

export function hasSignature(text, line) {
  return lines(text).some(l => l.trim().toUpperCase() === line.toUpperCase())
}

function readReceipt(root) {
  try { return JSON.parse(fs.readFileSync(signaturesReceipt(root), 'utf8')).lines ?? [] } catch { return [] }
}

function strip(text, added) {
  const drop = new Set(added.map(l => l.toUpperCase()))
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const kept = lines(text).filter(l => !drop.has(l.trim().toUpperCase()))
  return kept.join(eol)
}

// Grava as assinaturas atuais de gameinfo*.gi no fim de dota.signatures, sem acumular linhas antigas.
// Retorna uma função que desfaz a operação (usada se a aplicação falhar mais adiante).
export function applySignatures(root) {
  const file = signaturesFile(root)
  if (!fs.existsSync(file)) return () => {}
  const current = fs.readFileSync(file, 'latin1')
  const previous = fs.existsSync(signaturesReceipt(root)) ? fs.readFileSync(signaturesReceipt(root)) : null
  const clean = strip(current, readReceipt(root))
  // Backup preservado; só é renovado se a Valve atualizou o arquivo (conteúdo limpo difere dele).
  const backup = signaturesBackup(root)
  if (!fs.existsSync(backup) || fs.readFileSync(backup, 'latin1') !== clean) fs.writeFileSync(backup, clean, 'latin1')
  const eol = clean.includes('\r\n') || !clean.includes('\n') ? '\r\n' : '\n'
  const added = []
  let text = clean
  for (const { line } of expectedSignatures(root)) {
    if (hasSignature(clean, line)) continue
    if (text && !text.endsWith('\n')) text += eol
    text += line + eol
    added.push(line)
  }
  fs.writeFileSync(file, text, 'latin1')
  fs.writeFileSync(signaturesReceipt(root), JSON.stringify({ app: 'dota-local-skins', lines: added }))
  return () => {
    fs.writeFileSync(file, current, 'latin1')
    if (previous) fs.writeFileSync(signaturesReceipt(root), previous)
    else fs.rmSync(signaturesReceipt(root), { force: true })
  }
}

// Remove as linhas do app (ou restaura o backup original) e apaga o backup e o recibo.
export function restoreSignatures(root) {
  const file = signaturesFile(root)
  const backup = signaturesBackup(root)
  const receipt = signaturesReceipt(root)
  if (fs.existsSync(receipt)) {
    if (fs.existsSync(file)) {
      const current = fs.readFileSync(file, 'latin1')
      const clean = strip(current, readReceipt(root))
      if (clean !== current) fs.writeFileSync(file, clean, 'latin1')
    }
  } else if (fs.existsSync(backup)) fs.copyFileSync(backup, file)
  fs.rmSync(receipt, { force: true })
  fs.rmSync(backup, { force: true })
}

export function isDotaRunning() {
  if (process.platform !== 'win32') return false
  try {
    const out = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq dota2.exe', '/FO', 'CSV', '/NH'],
      { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
    return /dota2\.exe/i.test(out)
  } catch { return false }
}

export function assertDotaClosed() {
  if (isDotaRunning()) throw Error('O Dota 2 está aberto. Feche o jogo completamente antes de aplicar ou restaurar.')
}
