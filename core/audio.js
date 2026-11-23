import fs from 'node:fs'
import { baseArchive } from './diagnostics.js'
import { openVpk } from './vpk.js'

const HERO_VO_DIR = {
  crystal_maiden: 'crystalmaiden',
  drow_ranger: 'drowranger',
  nature_prophet: 'furion',
  necrolyte: 'necrolyte',
  obsidian_destroyer: 'outworld_destroyer',
  queenofpain: 'queenofpain',
  rattletrap: 'rattletrap',
  shredder: 'shredder',
  treant: 'treant',
  vengefulspirit: 'vengefulspirit',
  windrunner: 'windrunner',
  zuus: 'zuus',
}

const CRITERIA_PREFIX = [
  ['am_pers_wei', 'amp_wei_'],
  ['jungle_axe', 'jung_axe_'],
  ['cm_wolf', 'cm_wolf_'],
  ['davion_persona', 'dk_davion_'],
  ['kid_persona', 'kidvoker_'],
  ['happy_kidvoker', 'kidvoker_'],
  ['mir_nfx_per', 'mir_'],
  ['toy_pudge', 'toy_pug_'],
  ['toy_pug', 'toy_pug_'],
  ['pudge_cute', 'toy_pug_'],
  ['pudarc', 'pud_arc_'],
  ['fv_arcana', 'fv_arc_'],
  ['drow_arcana', 'drow_arc_'],
  ['eartharc', 'earth_arcana_'],
  ['voth_domosh', 'legcom_dem_'],
  ['mkarc', 'monkey_crown_'],
  ['jgarc', 'jug_arc_'],
  ['legacycall', 'jug_arc_'],
  ['ogflock', 'ogm_arc_'],
  ['cubelife', '_arcana'],
  ['imperia', 'imperia_'],
  ['venge_crown', 'venge_crown_'],
  ['skywrath_crown', 'skywrath_crown_'],
  ['fs_spectre', 'fs_spectre_'],
  ['spec_arc', 'spec_arc_'],
  ['wr_arc', 'wr_arc_'],
  ['qop_arc', 'qop_arc_'],
  ['skel_arc', 'skel_arc_'],
  ['wraith', 'skel_arc_'],
  ['razor', 'raz_arc_'],
  ['pa_persona', 'pa_as_'],
  ['phantom_assassin', 'phass_arc_'],
]

const MUSIC_CUES = [
  ['ui_main', 'Menu principal'],
  ['ui_startup', 'Tema de abertura'],
  ['ui_hero_select', 'Seleção de heróis'],
  ['battle_01', 'Tema de batalha'],
  ['laning_01', 'Fase de rotas'],
  ['roshan', 'Tema do Roshan'],
]

const VOICE_BUCKETS = [
  [/spawn|welcome|battlebegins/i, 'Fala de entrada'],
  [/1stblood|firstblood|kill|rampage|godlike|dominat/i, 'Abate especial'],
  [/laugh/i, 'Risada'],
  [/move|attack|cast|ability|rare/i, 'Fala em combate'],
]

function wavHeader(pcmLength, sampleRate, channels, bitsPerSample = 16) {
  const header = Buffer.alloc(44)
  const blockAlign = channels * (bitsPerSample >> 3)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + pcmLength, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * blockAlign, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(pcmLength, 40)
  return header
}

function isMp3(buf) {
  if (buf.length < 4) return false
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true // ID3
  return buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0
}

// Decodifica um .vsnd_c do Source 2 diretamente em MP3 ou WAV (sem depender de CLI externo).
export function decodeVsnd(buffer, { maxPcmSeconds = 25 } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null
  const streamOff = buffer.readUInt32LE(0)
  const version = buffer.readUInt16LE(6)
  const blockOff = buffer.readUInt32LE(8) + 8
  const blockCount = buffer.readUInt32LE(12)
  if (streamOff >= buffer.length || blockCount > 64 || blockOff + blockCount * 12 > buffer.length) return null

  let dataOff = 0, dataSize = 0
  for (let i = 0; i < blockCount; i++) {
    const o = blockOff + i * 12
    if (buffer.toString('ascii', o, o + 4) === 'DATA') {
      dataOff = o + 4 + buffer.readUInt32LE(o + 4)
      dataSize = buffer.readUInt32LE(o + 8)
      break
    }
  }
  const d = dataOff && dataOff + Math.min(dataSize, 16) <= buffer.length ? buffer.subarray(dataOff, dataOff + dataSize) : null
  const duration = d && d.length >= 16 ? d.readFloatLE(12) : 0
  const stream = buffer.subarray(streamOff)

  if (isMp3(stream)) {
    return { mime: 'audio/mpeg', data: stream, duration: Number.isFinite(duration) && duration > 0 ? duration : 0 }
  }
  if (stream.length >= 12 && stream.toString('ascii', 0, 4) === 'RIFF') {
    return { mime: 'audio/wav', data: stream, duration: Number.isFinite(duration) && duration > 0 ? duration : 0 }
  }

  // PCM16 bruto: versão <= 3 (bitpacked em d[0..3]) ou versão >= 4 (sampleRate u16, type u8, channels u8)
  if (!d || d.length < 16) return null
  let isPcm = false, sampleRate = 44100, channels = 2
  if (version <= 3) {
    const packed = d.readUInt32LE(0)
    isPcm = (packed & 0x0f) === 1
    sampleRate = (packed >>> 14) || 44100
    channels = ((packed >>> 7) & 3) || 2
  } else {
    isPcm = d[2] === 0
    sampleRate = d.readUInt16LE(0) || 44100
    channels = d[3] || 2
  }
  if (!isPcm || sampleRate < 8000 || sampleRate > 96000 || channels < 1 || channels > 2) return null

  const frameBytes = channels * 2
  const maxBytes = Math.floor(maxPcmSeconds * sampleRate) * frameBytes
  const usable = Math.floor(Math.min(stream.length, maxBytes) / frameBytes) * frameBytes
  const pcm = Buffer.from(stream.subarray(0, usable))
  if (usable < stream.length && pcm.length >= frameBytes * 100) {
    // Fade-out suave de 0.4s quando a trilha PCM longa é recortada para prévia
    const fadeFrames = Math.min(Math.floor(sampleRate * 0.4), Math.floor(pcm.length / frameBytes))
    const startFrame = Math.floor(pcm.length / frameBytes) - fadeFrames
    for (let f = 0; f < fadeFrames; f++) {
      const gain = 1 - f / fadeFrames
      for (let ch = 0; ch < channels; ch++) {
        const idx = (startFrame + f) * frameBytes + ch * 2
        pcm.writeInt16LE(Math.round(pcm.readInt16LE(idx) * gain), idx)
      }
    }
  }
  const wav = Buffer.concat([wavHeader(pcm.length, sampleRate, channels, 16), pcm])
  return { mime: 'audio/wav', data: wav, duration: pcm.length / (sampleRate * frameBytes) }
}

function niceTrackLabel(entry, fallback) {
  const base = entry.split('/').pop().replace(/\.vsnd_c$/i, '')
  for (const [pattern, label] of VOICE_BUCKETS) if (pattern.test(base)) return label
  return fallback || base.replace(/_/g, ' ')
}

function pickDiverse(entries, limit = 4) {
  if (!entries.length) return []
  const chosen = []
  const used = new Set()
  for (const [pattern, label] of VOICE_BUCKETS) {
    const match = entries.find(p => !used.has(p) && pattern.test(p))
    if (match) {
      used.add(match)
      chosen.push({ entry: match, label, caption: '' })
      if (chosen.length >= limit) return chosen
    }
  }
  for (const entry of entries) {
    if (used.has(entry)) continue
    used.add(entry)
    chosen.push({ entry, label: niceTrackLabel(entry, 'Prévia ' + (chosen.length + 1)), caption: '' })
    if (chosen.length >= limit) break
  }
  return chosen
}

function extractChatwheelPrefix(cw, dir) {
  const clean = cw.toLowerCase()
  const candidates = [dir + '_', dir.replace(/_/g, '') + '_']
  for (const prefix of candidates) {
    if (clean.startsWith(prefix)) {
      const rest = clean.slice(prefix.length)
      const parts = rest.split('_')
      if (parts.length >= 3) return parts.slice(0, 2).join('_') + '_'
    }
  }
  return null
}

export function createAudioReader(root) {
  const archive = baseArchive(root)
  let pack, stamp, voByDir, musicByDir, tauntByDir

  function ensureIndex() {
    const stat = fs.statSync(archive)
    const key = stat.size + ':' + stat.mtimeMs
    if (key === stamp && pack) return
    pack = openVpk(archive, p => p.endsWith('.vsnd_c') && (
      p.startsWith('sounds/vo/') || p.startsWith('sounds/music/') ||
      (p.startsWith('sounds/weapons/hero/') && p.includes('taunt'))
    ))
    voByDir = new Map()
    musicByDir = new Map()
    tauntByDir = new Map()
    for (const p of pack.paths()) {
      const parts = p.split('/')
      if (parts.length < 4) continue
      if (parts[1] === 'weapons' && parts[2] === 'hero' && parts.length >= 5) {
        const dir = parts[3]
        if (!tauntByDir.has(dir)) tauntByDir.set(dir, [])
        tauntByDir.get(dir).push(p)
        continue
      }
      const dir = parts[2]
      const target = parts[1] === 'music' ? musicByDir : voByDir
      if (!target.has(dir)) target.set(dir, [])
      target.get(dir).push(p)
    }
    stamp = key
  }

  function resolveTracks(meta) {
    if (!meta) return []
    ensureIndex()
    if (meta.kind === 'music' && meta.musicPrefix) {
      const candidates = [meta.musicPrefix, meta.musicPrefix.replace(/^shop_/, '')]
      const list = candidates.map(c => musicByDir.get(c)).find(Boolean) || []
      if (!list.length) return []
      const picked = []
      const used = new Set()
      for (const [cue, label] of MUSIC_CUES) {
        const match = list.find(p => !used.has(p) && p.includes('/' + cue) && !p.includes('_end'))
        if (match) {
          used.add(match)
          picked.push({ entry: match, label, caption: label })
          if (picked.length >= 4) return picked
        }
      }
      for (const entry of list) {
        if (used.has(entry) || entry.includes('_end') || entry.includes('null')) continue
        picked.push({ entry, label: 'Trilha ' + (picked.length + 1), caption: '' })
        if (picked.length >= 4) break
      }
      return picked
    }

    // Clipes oficiais announcer_preview (locutores, mega-kills e voice packs com legendas localizadas)
    if (meta.clips?.length) {
      const official = []
      for (const clip of meta.clips) {
        const entry = clip.path.endsWith('_c') ? clip.path : clip.path + '_c'
        if (pack.has(entry)) {
          official.push({
            entry,
            label: niceTrackLabel(entry, 'Fala ' + (official.length + 1)),
            caption: clip.caption || '',
          })
        }
        if (official.length >= 4) break
      }
      if (official.length) return official
    }

    if ((meta.kind === 'announcer' || meta.kind === 'mega_kills') && meta.folder) {
      return pickDiverse(voByDir.get(meta.folder) || [], 4)
    }

    if (meta.kind === 'taunt' && meta.heroId) {
      const short = meta.heroId.replace(/^npc_dota_hero_/, '').toLowerCase()
      const voDir = HERO_VO_DIR[short] || (voByDir.has(short) ? short : short.replace(/_/g, ''))
      const sfx = tauntByDir.get(short) || tauntByDir.get(voDir) || tauntByDir.get(short.replace(/_/g, '')) || []
      const vo = (voByDir.get(voDir) || []).filter(p => /taunt/i.test(p.split('/').pop()))
      const picked = []
      for (const entry of sfx.slice(0, 2)) picked.push({ entry, label: 'Som da provocação', caption: meta.englishName || '' })
      for (const entry of vo.slice(0, 4 - picked.length)) picked.push({ entry, label: 'Fala da provocação', caption: '' })
      return picked
    }

    if (meta.kind === 'voice' && meta.heroId) {
      const short = meta.heroId.replace(/^npc_dota_hero_/, '').toLowerCase()
      const dir = HERO_VO_DIR[short] || (voByDir.has(short) ? short : short.replace(/_/g, ''))
      const files = voByDir.get(dir) || []
      if (!files.length) return []

      // 1. Tenta prefixo exato vindo de chatwheel ou mapa de criteria (Arcanas/Personas)
      const prefixes = []
      for (const cw of meta.chatwheel || []) {
        const pref = extractChatwheelPrefix(cw, dir)
        if (pref) prefixes.push(pref)
      }
      for (const crit of meta.criteria || []) {
        for (const [needle, pref] of CRITERIA_PREFIX) {
          if (crit.includes(needle)) prefixes.push(pref)
        }
      }
      for (const pref of [...new Set(prefixes)]) {
        const matched = files.filter(p => p.split('/').pop().includes(pref))
        if (matched.length) return pickDiverse(matched, 4)
      }
      // 2. Fallback genérico para arcanas/personas pelo nome do arquivo na pasta do herói
      if ((meta.criteria || []).some(c => /arc|persona|crown|wolf|wei/i.test(c))) {
        const matched = files.filter(p => /_arc|arcana|persona|crown|wolf|wei/i.test(p.split('/').pop()))
        if (matched.length) return pickDiverse(matched, 4)
      }
    }
    return []
  }

  function decodeEntry(entry) {
    ensureIndex()
    if (typeof entry !== 'string' || !/^sounds\/(?:vo|music|weapons\/hero)\/[\w./ -]+\.vsnd_c$/i.test(entry) || entry.includes('..')) {
      throw Error('Caminho de áudio inválido.')
    }
    if (!pack.has(entry)) throw Error('Arquivo de áudio não encontrado no VPK.')
    const decoded = decodeVsnd(pack.read(entry))
    if (!decoded) throw Error('Formato de áudio não suportado para prévia.')
    return {
      entry,
      url: 'data:' + decoded.mime + ';base64,' + decoded.data.toString('base64'),
      duration: decoded.duration,
    }
  }

  return {
    preview(meta) {
      const tracks = resolveTracks(meta)
      if (!tracks.length) return { tracks: [], initial: null, reason: 'Nenhuma faixa de prévia encontrada no VPK para este item.' }
      for (let i = 0; i < tracks.length; i++) {
        try {
          const initial = decodeEntry(tracks[i].entry)
          return { tracks, initial, initialIndex: i }
        } catch { /* tenta a próxima faixa */ }
      }
      return { tracks, initial: null, reason: 'Não foi possível decodificar o áudio deste item.' }
    },
    track: decodeEntry,
  }
}
