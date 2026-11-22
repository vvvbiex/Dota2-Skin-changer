import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { crc32 } from 'node:zlib'

export const ITEMS_PATH = 'scripts/items/items_game.txt'
const SIGNATURE = 0x55aa1234
const INTERNAL = 0x7fff

function readRange(file, offset, size) {
  const fd = fs.openSync(file, 'r')
  try {
    if (offset + size > fs.fstatSync(fd).size) throw Error('Intervalo fora do arquivo VPK.')
    const data = Buffer.alloc(size)
    let position = 0
    while (position < size) {
      const count = fs.readSync(fd, data, position, size - position, offset + position)
      if (!count) throw Error('Leitura incompleta do VPK.')
      position += count
    }
    return data
  } finally { fs.closeSync(fd) }
}

/** Open a Valve directory VPK. Only matching entries are retained in memory. */
export function openVpk(file, include = () => true) {
  const header = readRange(file, 0, 12)
  const version = header.readUInt32LE(4)
  if (header.readUInt32LE() !== SIGNATURE || ![1, 2].includes(version)) {
    throw Error('Assinatura ou versão de VPK inválida.')
  }
  const treeSize = header.readUInt32LE(8)
  const headerSize = version === 1 ? 12 : 28
  const inlineSize = version === 2 ? readRange(file, 12, 16).readUInt32LE() : Infinity
  const tree = readRange(file, headerSize, treeSize)
  let cursor = 0
  function string() {
    const end = tree.indexOf(0, cursor)
    if (end === -1) throw Error('String incompleta no índice VPK.')
    const value = tree.toString('utf8', cursor, end)
    cursor = end + 1
    return value
  }
  const entries = new Map()
  for (let ext; (ext = string());) {
    for (let dir; (dir = string());) {
      for (let name; (name = string());) {
        if (cursor + 18 > tree.length || tree.readUInt16LE(cursor + 16) !== 0xffff) {
          throw Error('Entrada inválida no índice VPK.')
        }
        const path = (dir === ' ' ? '' : dir + '/') + name + (ext === ' ' ? '' : '.' + ext)
        const preload = tree.readUInt16LE(cursor + 4)
        const end = cursor + 18 + preload
        if (end > tree.length) throw Error('Preload truncado no índice VPK.')
        if (include(path)) {
          if (entries.has(path)) throw Error('Entrada duplicada no VPK: ' + path)
          entries.set(path, {
            crc: tree.readUInt32LE(cursor), archive: tree.readUInt16LE(cursor + 6),
            offset: tree.readUInt32LE(cursor + 8), size: tree.readUInt32LE(cursor + 12),
            prefix: Buffer.from(tree.subarray(cursor + 18, end)),
          })
        }
        cursor = end
      }
    }
  }
  return {
    version,
    checksum: path => entries.get(path)?.crc,
    has: path => entries.has(path),
    paths: () => entries.keys(),
    read(path) {
      const entry = entries.get(path)
      if (!entry) throw Error('Arquivo ausente no VPK: ' + path)
      const { archive, size, prefix } = entry
      const inline = archive === INTERNAL
      if (inline && entry.offset + size > inlineSize) throw Error('Dados fora da seção interna.')
      if (!inline && !/_dir\.vpk$/i.test(file)) throw Error('Nome de índice multipartes inválido.')
      const part = inline ? file : file.replace(/_dir\.vpk$/i, '_' + String(archive).padStart(3, '0') + '.vpk')
      const offset = entry.offset + (inline ? headerSize + treeSize : 0)
      const body = size ? readRange(part, offset, size) : Buffer.alloc(0)
      const data = prefix.length ? Buffer.concat([prefix, body]) : body
      if (crc32(data) !== entry.crc) throw Error('CRC32 incorreto: ' + path)
      return data
    },
  }
}

/** Valve VPK v2 with embedded data and all three directory MD5 checksums. */
export function buildItemsVpk(text) {
  const data = Buffer.from(text, 'utf8')
  const entry = Buffer.alloc(18)
  entry.writeUInt32LE(crc32(data))
  entry.writeUInt16LE(INTERNAL, 6)
  entry.writeUInt32LE(data.length, 12)
  entry.writeUInt16LE(0xffff, 16)
  const tree = Buffer.concat([Buffer.from('txt\0scripts/items\0items_game\0'), entry, Buffer.alloc(3)])
  const header = Buffer.alloc(28)
  header.writeUInt32LE(SIGNATURE)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(tree.length, 8)
  header.writeUInt32LE(data.length, 12)
  header.writeUInt32LE(48, 20)
  const md5 = parts => {
    const hash = createHash('md5')
    for (const part of parts) hash.update(part)
    return hash.digest()
  }
  const parts = [header, tree, data, md5([tree]), md5([])]
  return Buffer.concat([...parts, md5(parts)])
}
