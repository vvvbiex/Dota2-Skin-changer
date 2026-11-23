import fs from 'node:fs'
import path from 'node:path'
import { sha } from './diagnostics.js'
import { atomicWrite } from './install.js'

const WIKI_API = 'https://liquipedia.net/dota2/api.php'
const ALLOWED_MEDIA_HOST = 'liquipedia.net'
const USER_AGENT = 'Dota2LocalSkinChanger/1.4 (https://github.com/vvvbiex/Dota2-Skin-changer; local taunt preview)'
const MAX_BYTES = 16 * 1024 * 1024
const TIMEOUT_MS = 12000

const MIME_BY_EXT = {
  webm: 'video/webm',
  mp4: 'video/mp4',
  gif: 'image/gif',
}

function detectMedia(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12 || buf.length > MAX_BYTES) return null
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { ext: 'webm', mime: 'video/webm', kind: 'video' }
  }
  if (buf.toString('ascii', 0, 4) === 'GIF8') {
    return { ext: 'gif', mime: 'image/gif', kind: 'image' }
  }
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    return { ext: 'mp4', mime: 'video/mp4', kind: 'video' }
  }
  return null
}

function normalizeTitle(name) {
  return String(name || '').replace(/\s+/g, ' ').trim()
}

function pickMediaFromWikitext(wikitext) {
  const matches = [...String(wikitext || '').matchAll(/\[\[File:([^|\]]+\.(?:webm|mp4|gif))/gi)].map(m => m[1].trim())
  if (!matches.length) return null
  return matches.find(f => /\.webm$/i.test(f)) || matches.find(f => /\.mp4$/i.test(f)) || matches[0]
}

export function createTauntVideoReader(cacheDir, { fetchImpl = globalThis.fetch } = {}) {
  const inflight = new Map()

  function readCached(key) {
    for (const ext of ['webm', 'mp4', 'gif']) {
      const file = path.join(cacheDir, key + '.' + ext)
      if (!fs.existsSync(file)) continue
      try {
        const bytes = fs.readFileSync(file)
        const info = detectMedia(bytes)
        if (!info) continue
        return {
          kind: info.kind,
          mime: info.mime,
          url: 'data:' + info.mime + ';base64,' + bytes.toString('base64'),
          cached: true,
        }
      } catch { /* ignora cache corrompido */ }
    }
    return null
  }

  async function wikiJson(params) {
    const query = new URLSearchParams({ ...params, format: 'json' })
    const res = await fetchImpl(WIKI_API + '?' + query.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!res.ok) throw Error('Wiki indisponível (HTTP ' + res.status + ').')
    return res.json()
  }

  async function resolveMediaFile(title) {
    const first = await wikiJson({ action: 'parse', page: title.replace(/ /g, '_'), prop: 'wikitext', redirects: '1' })
    const direct = pickMediaFromWikitext(first?.parse?.wikitext?.['*'])
    if (direct) return direct

    const search = await wikiJson({ action: 'query', list: 'search', srsearch: title, srlimit: '3' })
    const hit = search?.query?.search?.find(item => /^taunt/i.test(item.title)) || search?.query?.search?.[0]
    if (!hit?.title) return null
    const second = await wikiJson({ action: 'parse', page: hit.title.replace(/ /g, '_'), prop: 'wikitext', redirects: '1' })
    return pickMediaFromWikitext(second?.parse?.wikitext?.['*'])
  }

  async function fetchAndCache(key, title) {
    const fileName = await resolveMediaFile(title)
    if (!fileName) return { url: null, reason: 'Vídeo da provocação não encontrado na Dota 2 Wiki.' }

    const infoJson = await wikiJson({ action: 'query', titles: 'File:' + fileName, prop: 'imageinfo', iiprop: 'url|size|mime' })
    const pages = Object.values(infoJson?.query?.pages || {})
    const imageInfo = pages[0]?.imageinfo?.[0]
    if (!imageInfo?.url) return { url: null, reason: 'Arquivo de mídia ausente na Wiki.' }
    if (imageInfo.size && imageInfo.size > MAX_BYTES) return { url: null, reason: 'Vídeo muito grande para prévia local.' }

    const mediaUrl = new URL(imageInfo.url)
    if (mediaUrl.protocol !== 'https:' || mediaUrl.hostname !== ALLOWED_MEDIA_HOST) {
      throw Error('Origem de mídia não autorizada.')
    }
    const mediaRes = await fetchImpl(mediaUrl.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!mediaRes.ok) throw Error('Falha ao baixar vídeo (HTTP ' + mediaRes.status + ').')
    const bytes = Buffer.from(await mediaRes.arrayBuffer())
    const detected = detectMedia(bytes)
    if (!detected) throw Error('Arquivo baixado não é um vídeo WebM/MP4 ou GIF válido.')

    fs.mkdirSync(cacheDir, { recursive: true })
    atomicWrite(path.join(cacheDir, key + '.' + detected.ext), bytes)
    return {
      kind: detected.kind,
      mime: detected.mime || MIME_BY_EXT[detected.ext],
      url: 'data:' + detected.mime + ';base64,' + bytes.toString('base64'),
      cached: false,
    }
  }

  async function getVideo(meta) {
    const title = normalizeTitle(meta?.englishName || meta?.name)
    if (!title) return { url: null, reason: 'Nome da provocação ausente.' }
    const key = sha(title.toLowerCase())
    const cached = readCached(key)
    if (cached) return cached
    if (inflight.has(key)) return inflight.get(key)
    const job = fetchAndCache(key, title)
      .catch(error => ({ url: null, reason: error.message || 'Falha ao buscar prévia na Wiki.' }))
      .finally(() => inflight.delete(key))
    inflight.set(key, job)
    return job
  }

  return { getVideo }
}
