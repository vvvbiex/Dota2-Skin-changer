import fs from 'node:fs'
import { crc32 } from 'node:zlib'

// Zip mínimo, apenas modo STORE (sem compressão): leitura aleatória instantânea.
export function writeZipStore(file, entries) {
  const fd = fs.openSync(file, 'w')
  try {
    let offset = 0
    const central = []
    const write = buffer => { fs.writeSync(fd, buffer); offset += buffer.length }
    for (const [name, data] of entries) {
      const nameBytes = Buffer.from(name, 'utf8')
      const crc = crc32(data)
      const local = Buffer.alloc(30)
      local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6)
      local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22)
      local.writeUInt16LE(nameBytes.length, 26)
      const start = offset
      write(local); write(nameBytes); write(data)
      const head = Buffer.alloc(46)
      head.writeUInt32LE(0x02014b50); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x0800, 8)
      head.writeUInt32LE(crc, 16); head.writeUInt32LE(data.length, 20); head.writeUInt32LE(data.length, 24)
      head.writeUInt16LE(nameBytes.length, 28); head.writeUInt32LE(start, 42)
      central.push(head, nameBytes)
    }
    const directory = Buffer.concat(central), count = central.length / 2
    if (count > 0xffff || offset + directory.length > 0xffffffff) throw Error('Pacote grande demais para zip simples.')
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10)
    end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16)
    write(directory); write(end)
  } finally { fs.closeSync(fd) }
}

// Indexa o diretório central uma vez e lê cada arquivo sob demanda.
export function openZipStore(file) {
  const size = fs.statSync(file).size
  const fd = fs.openSync(file, 'r')
  const read = (position, length) => {
    const buffer = Buffer.alloc(length)
    fs.readSync(fd, buffer, 0, length, position)
    return buffer
  }
  try {
    const tail = read(Math.max(0, size - 65557), Math.min(size, 65557))
    const at = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
    if (at < 0) throw Error('Pacote de ícones inválido.')
    const count = tail.readUInt16LE(at + 10), length = tail.readUInt32LE(at + 12), start = tail.readUInt32LE(at + 16)
    const directory = read(start, length)
    const files = new Map()
    let cursor = 0
    for (let i = 0; i < count; i++) {
      if (directory.readUInt32LE(cursor) !== 0x02014b50) throw Error('Diretório do pacote de ícones inválido.')
      const method = directory.readUInt16LE(cursor + 10), packed = directory.readUInt32LE(cursor + 20)
      const nameLength = directory.readUInt16LE(cursor + 28), extra = directory.readUInt16LE(cursor + 30)
      const comment = directory.readUInt16LE(cursor + 32), offset = directory.readUInt32LE(cursor + 42)
      const name = directory.toString('utf8', cursor + 46, cursor + 46 + nameLength)
      if (method === 0) files.set(name, { offset, size: packed })
      cursor += 46 + nameLength + extra + comment
    }
    return {
      has: name => files.has(name),
      names: () => [...files.keys()],
      read(name) {
        const item = files.get(name)
        if (!item) return null
        const header = read(item.offset, 30)
        const data = item.offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
        return read(data, item.size)
      },
      close: () => fs.closeSync(fd),
    }
  } catch (error) {
    fs.closeSync(fd)
    throw error
  }
}
