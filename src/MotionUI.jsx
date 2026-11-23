import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import dotaLogo from './dota-logo.png'
import { Icon } from './ui.jsx'

const springTab = { type: 'spring', stiffness: 420, damping: 29, mass: 0.9 }
const springKnob = { type: 'spring', stiffness: 520, damping: 32, mass: 0.8 }

// 1. Segmented Navigation Control (baseado em Segmented Navigation Control.html)
export function SegmentedControl({ label, options, value, onChange, layoutId, className = '', nav = false }) {
  const Tag = nav ? 'nav' : 'div'
  return <Tag className={'seg-control ' + className} role={nav ? undefined : 'group'} aria-label={label}>
    {options.map(option => {
      const active = option.id === value
      return <button key={option.id} type="button" className="seg-item"
        aria-current={nav && active ? 'page' : undefined}
        aria-pressed={nav ? undefined : active}
        title={option.label}
        onClick={() => onChange(option.id)}>
        {active && <motion.span layoutId={layoutId} className="seg-thumb" transition={springTab}/>}
        <span className="seg-label">
          {option.icon && <Icon name={option.icon}/>}
          <span>{option.label}</span>
          {option.count != null && <span className="segment-count">{option.count}</span>}
        </span>
      </button>
    })}
  </Tag>
}

// 2. Day & Night Theme Switcher (baseado em Day & Night Theme Switcher.html)
export function ThemeSwitcher({ theme, onToggle }) {
  const dark = theme === 'dark'
  const [pulse, setPulse] = useState(0)
  function handleClick() {
    setPulse(n => n + 1)
    onToggle()
  }
  return <button type="button" className="theme-switcher" onClick={handleClick}
    aria-label={dark ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
    title={dark ? 'Modo escuro (clique para modo claro)' : 'Modo claro (clique para modo escuro)'}
    data-dark={dark}>
    <span className="theme-icons" aria-hidden="true">
      <motion.svg className="theme-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
        animate={{ opacity: dark ? 0 : 1, rotate: dark ? 90 : 0, scale: dark ? 0.5 : 1 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>
      </motion.svg>
      <motion.svg className="theme-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        animate={{ opacity: dark ? 1 : 0, rotate: dark ? 0 : -90, scale: dark ? 1 : 0.5 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
        <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>
      </motion.svg>
    </span>
    <span className="theme-track" aria-hidden="true">
      <motion.span className="theme-knob"
        animate={{ x: dark ? 18 : 0 }}
        transition={springKnob}>
        <motion.span key={pulse} className="theme-knob-core"
          initial={pulse ? { scaleX: 1 } : false}
          animate={pulse ? { scaleX: [1, 1.28, 1] } : { scaleX: 1 }}
          transition={{ duration: 0.34, ease: 'easeInOut' }}/>
      </motion.span>
    </span>
  </button>
}

// 3. Google Gemini Image Studio Loading Widget (baseado em gemini-image.html)
const SPARK_PATH = 'M12 1.4C12.35 7.9 16.1 11.65 22.6 12C16.1 12.35 12.35 16.1 12 22.6C11.65 16.1 7.9 12.35 1.4 12C7.9 11.65 11.65 7.9 12 1.4Z'
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const smooth = p => { const c = clamp(p); return c * c * (3 - 2 * c) }
const mix = (a, b, p) => a + (b - a) * p
const hexMix = (a, b, p) => {
  const c = clamp(p)
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
  return `rgb(${pa.map((v, i) => Math.round(mix(v, pb[i], c))).join(',')})`
}

// Ordem embaralhada determinística dos 36 blocos (6x6), fiel ao gg_RK do gemini-image.html
const TILE_ORDER = (() => {
  const hash = i => Math.sin(i * 127.1 + 311.7) * 43758.5453 % 1
  const idx = [...Array(36)].map((_, i) => i).sort((a, b) => hash(a) - hash(b))
  const rank = []
  idx.forEach((tile, order) => { rank[tile] = order })
  return rank
})()

function ShimmerText({ text, time, dark }) {
  const chars = [...text]
  const width = 4.2
  const cyc = chars.length + width * 2 + 4
  const pos = ((time * 0.85 * chars.length * 0.9) % cyc + cyc) % cyc - width
  const base = dark ? '#76767e' : '#787880'
  const hi = dark ? '#ffffff' : '#141416'
  return <span className="studio-shimmer">{chars.map((ch, i) => {
    const k = Math.max(0, 1 - Math.abs(i - pos) / width)
    return <span key={i} style={{ color: hexMix(base, hi, smooth(k)) }}>{ch === ' ' ? '\u00A0' : ch}</span>
  })}</span>
}

function RollingPercent({ value }) {
  const digits = String(Math.round(clamp(value, 0, 100))).split('')
  return <span className="studio-odo" aria-hidden="true">
    {digits.map((digit, index) => <span key={digits.length - index} className="studio-digit-col">
      <span className="studio-digit-strip" style={{ transform: `translateY(${-Number(digit) * 1.15}em)` }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <b key={n}>{n}</b>)}
      </span>
    </span>)}
    <span className="studio-pct-sign">%</span>
  </span>
}

export function ApplyStudioOverlay({ state, theme, onDismiss }) {
  const [frame, setFrame] = useState({ t: 0, progress: 0 })
  const stateRef = useRef(state)
  stateRef.current = state
  const startRef = useRef(0)
  const progressRef = useRef(0)

  useEffect(() => {
    if (!state) {
      progressRef.current = 0
      return
    }
    startRef.current = performance.now()
    progressRef.current = 0
    let raf = 0
    const tick = now => {
      const elapsed = (now - startRef.current) / 1000
      const cur = stateRef.current
      if (!cur) return
      let target = 0
      if (cur.phase === 'done') target = 1
      else if (cur.phase === 'launching') target = Math.min(0.96, 0.78 + (1 - Math.exp(-elapsed * 0.8)) * 0.18)
      else target = Math.min(0.91, (1 - Math.exp(-elapsed * 1.15)) * 0.92)
      const speed = cur.phase === 'done' ? 0.18 : 0.08
      progressRef.current = progressRef.current + (target - progressRef.current) * speed
      if (cur.phase === 'done' && progressRef.current > 0.992) progressRef.current = 1
      setFrame({ t: elapsed, progress: progressRef.current })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [Boolean(state)])

  const dark = theme === 'dark'
  const isDone = state?.phase === 'done' && frame.progress >= 0.98
  const t = frame.t
  const p = frame.progress
  const sweepPos = ((t * 58) % 115) - 25
  const rot = (t * 95) + Math.sin(t * 1.1) * 9
  const miniOpacity = Math.pow(Math.max(0, Math.sin(t * 2.1 + 0.6)), 3)
  const blurPx = (3.4 * Math.pow(1 - p, 1.35)).toFixed(2)
  const tileBase = dark ? '#16161b' : '#e6e6eb'
  const tileBand = dark ? '#3c1b1d' : '#f7d4d2'
  const tileGlint = dark ? '#ff9b95' : '#ff453a'

  return <AnimatePresence>
    {state && <motion.div className="studio-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={isDone ? onDismiss : undefined}>
      <motion.div className="studio-card" role="status" aria-live="polite"
        initial={{ opacity: 0, y: 26, scale: 0.94, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 16, scale: 0.96, filter: 'blur(8px)' }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}>

        <div className="studio-top">
          <svg className="studio-spark" width="18" height="18" viewBox="0 0 24 24">
            <defs>
              <linearGradient id="studio-grad" gradientUnits="userSpaceOnUse" x1="3" y1="21" x2="21" y2="3">
                <stop offset="0" stopColor="#ff3b30"/>
                <stop offset="0.55" stopColor="#ff6961"/>
                <stop offset="1" stopColor="#ffb199"/>
              </linearGradient>
            </defs>
            <path d={SPARK_PATH} fill="url(#studio-grad)"
              transform={`rotate(${isDone ? 0 : rot.toFixed(1)} 12 12) translate(12 12) scale(${isDone ? 1.1 : (1 + 0.05 * Math.sin(t * 2.6)).toFixed(3)}) translate(-12 -12)`}/>
            {miniOpacity > 0.02 && <path d={SPARK_PATH} fill="#ff8a80" opacity={miniOpacity.toFixed(3)}
              transform={`translate(20.2 3.4) scale(${(0.28 * (0.4 + 0.6 * miniOpacity)).toFixed(3)}) translate(-12 -12)`}/>}
          </svg>
          <span className="studio-title">
            {state.title}
            {!isDone && <i className="studio-caret" aria-hidden="true"/>}
          </span>
        </div>

        <div className="studio-body">
          <div className="studio-thumb">
            <div className="studio-art" style={{ filter: `blur(${blurPx}px)`, transform: `scale(${(1 + 0.08 * p).toFixed(4)})` }}>
              <img src={dotaLogo} alt=""/>
            </div>
            <div className="studio-mosaic" aria-hidden="true">
              {TILE_ORDER.map((order, i) => {
                const cx = (i % 6) * 10
                const cy = Math.floor(i / 6) * 10
                const revealStart = (order / 36) * 0.84
                const local = clamp((p - revealStart) / 0.18)
                const opacity = 1 - smooth(local)
                if (opacity < 0.01) return <i key={i} style={{ opacity: 0 }}/>
                const band = Math.exp(-Math.pow((cx + cy) * 0.6 - sweepPos, 2) / 220) * (1 - p * 0.6)
                const glint = Math.sin(local * Math.PI) * 0.62
                const color = hexMix(hexMix(tileBase, tileBand, band), tileGlint, glint)
                const scale = 1 - 0.14 * smooth(local)
                return <i key={i} style={{ background: color, opacity: opacity.toFixed(3), transform: `scale(${scale.toFixed(3)})` }}/>
              })}
            </div>
          </div>

          <div className="studio-meta">
            <div className="studio-stage">
              {isDone ? <span className="studio-stage-done">Concluído</span> : <ShimmerText text={state.stage} time={t} dark={dark}/>}
            </div>

            <div className="studio-metric">
              <AnimatePresence mode="wait" initial={false}>
                {!isDone ? <motion.div key="pct" className="studio-pct-wrap"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}>
                  <RollingPercent value={p * 100}/>
                </motion.div>
                  : <motion.div key="done" className="studio-done-row"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 24 }}>
                    <motion.span className="studio-check"
                      initial={{ scale: 0.55 }} animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 20 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                        <motion.path d="M5 12.5l4.5 4.5L19 7.5"
                          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                          transition={{ duration: 0.34, delay: 0.08, ease: 'easeOut' }}/>
                      </svg>
                    </motion.span>
                    <strong>Pronto</strong>
                  </motion.div>}
              </AnimatePresence>
            </div>

            {!isDone ? <div className="studio-bar" aria-hidden="true">
              <div className="studio-bar-fill" style={{ transform: `translateX(${((clamp(p) - 1) * 100).toFixed(2)}%)` }}/>
            </div>
              : <motion.small className="studio-sub" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                {state.doneDetail}
              </motion.small>}
          </div>
        </div>
      </motion.div>
    </motion.div>}
  </AnimatePresence>
}

// 4. NotebookLM Audio Overview Player (baseado em notebooklm.html)
const KIND_LABEL = {
  music: 'Trilha sonora',
  announcer: 'Locutor',
  mega_kills: 'Locutor de matanças',
  voice: 'Voz personalizada',
  taunt: 'Provocação',
}
const formatTime = sec => {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const pseudoNoise = x => 0.5 * Math.sin(x * 0.9) + 0.32 * Math.sin(x * 2.3 + 1.3) + 0.18 * Math.sin(x * 4.1 + 2.1)

function NotebookMark({ size = 17 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" style={{ flex: 'none' }}>
    <path d="M3.5 18.5V13a8.5 8.5 0 0117 0v5.5"/>
    <path d="M8 18.5V13.5a4 4 0 018 0v5"/>
    <circle cx="12" cy="17.6" r="1.5" fill="currentColor" stroke="none"/>
  </svg>
}

function dataUrlToArrayBuffer(url) {
  const comma = url.indexOf(',')
  const raw = atob(comma >= 0 ? url.slice(comma + 1) : url)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

export function useAudioPreview(api) {
  const [state, setState] = useState(null)
  const [video, setVideo] = useState(null)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const gainRef = useRef(null)
  const sourceRef = useRef(null)
  const bufferRef = useRef(null)
  const offsetRef = useRef(0)
  const startedAtRef = useRef(0)
  const cacheRef = useRef(new Map())
  const reqRef = useRef(0)
  const videoReqRef = useRef(0)
  const stateRef = useRef(null)
  const videoRef = useRef(null)
  stateRef.current = state
  videoRef.current = video

  const ensureContext = useCallback(async () => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) throw Error('Web Audio API indisponível.')
      const ctx = new AudioCtx()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.78
      const gain = ctx.createGain()
      gain.gain.value = 0.8
      analyser.connect(gain)
      gain.connect(ctx.destination)
      ctxRef.current = ctx
      analyserRef.current = analyser
      gainRef.current = gain
    }
    if (ctxRef.current.state === 'suspended') await ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const stopSource = useCallback(() => {
    const src = sourceRef.current
    if (!src) return
    sourceRef.current = null
    src.onended = null
    try { src.stop() } catch { /* já encerrado */ }
    try { src.disconnect() } catch { /* ignorar */ }
  }, [])

  const startBuffer = useCallback(async (audioBuffer, startOffset, onComplete) => {
    const ctx = await ensureContext()
    stopSource()
    bufferRef.current = audioBuffer
    const duration = audioBuffer.duration || 0
    const safeOffset = clamp(startOffset, 0, Math.max(0, duration - 0.02))
    const src = ctx.createBufferSource()
    src.buffer = audioBuffer
    src.connect(analyserRef.current)
    sourceRef.current = src
    offsetRef.current = safeOffset
    startedAtRef.current = ctx.currentTime
    src.onended = () => {
      if (sourceRef.current !== src) return
      sourceRef.current = null
      offsetRef.current = duration
      onComplete?.()
    }
    src.start(0, safeOffset)
    return duration
  }, [ensureContext, stopSource])

  const decodeTrack = useCallback(async (entry, data) => {
    const cached = cacheRef.current.get(entry)
    if (cached) return cached
    const ctx = await ensureContext()
    const arrayBuffer = dataUrlToArrayBuffer(data.url)
    const decoded = await ctx.decodeAudioData(arrayBuffer)
    if (cacheRef.current.size > 24) cacheRef.current.clear()
    cacheRef.current.set(entry, decoded)
    return decoded
  }, [ensureContext])

  const selectTrackRef = useRef(null)

  const handleEnded = useCallback(() => {
    const cur = stateRef.current
    if (cur && cur.tracks.length > 1 && cur.index + 1 < cur.tracks.length) {
      selectTrackRef.current?.(cur.index + 1)
    } else {
      setState(prev => prev ? { ...prev, playing: false, currentTime: prev.duration } : prev)
    }
  }, [])

  const selectTrack = useCallback(async index => {
    const cur = stateRef.current
    if (!cur || !cur.tracks.length) return
    const nextIdx = ((index % cur.tracks.length) + cur.tracks.length) % cur.tracks.length
    const reqId = ++reqRef.current
    stopSource()
    setState(prev => prev ? { ...prev, index: nextIdx, loading: true, playing: false, currentTime: 0, error: '' } : prev)
    try {
      const track = cur.tracks[nextIdx]
      let audioBuffer = cacheRef.current.get(track.entry)
      if (!audioBuffer) {
        const data = await api.audioTrack(track.entry)
        if (reqRef.current !== reqId) return
        audioBuffer = await decodeTrack(track.entry, data)
      }
      if (reqRef.current !== reqId) return
      const duration = await startBuffer(audioBuffer, 0, handleEnded)
      if (reqRef.current !== reqId) return
      setState(prev => prev ? { ...prev, loading: false, playing: true, currentTime: 0, duration, error: '' } : prev)
    } catch (e) {
      if (reqRef.current !== reqId) return
      setState(prev => prev ? { ...prev, loading: false, playing: false, error: e.message || 'Falha ao reproduzir áudio.' } : prev)
    }
  }, [api, decodeTrack, handleEnded, startBuffer, stopSource])

  selectTrackRef.current = selectTrack

  // Atualiza o relógio/scrubber suavemente enquanto o AudioBufferSourceNode toca
  useEffect(() => {
    if (!state?.playing) return
    const timer = setInterval(() => {
      const ctx = ctxRef.current
      const buf = bufferRef.current
      if (!ctx || !buf || !sourceRef.current) return
      const elapsed = Math.min(buf.duration, offsetRef.current + (ctx.currentTime - startedAtRef.current))
      setState(prev => prev && prev.playing ? { ...prev, currentTime: elapsed } : prev)
    }, 80)
    return () => clearInterval(timer)
  }, [state?.playing])

  useEffect(() => () => {
    stopSource()
    ctxRef.current?.close().catch(() => {})
  }, [stopSource])

  const openAudio = useCallback(async (item, iconUrl = null) => {
    if (!api?.audioPreview || !item?.audio) return
    videoReqRef.current++
    setVideo(null)
    const cur = stateRef.current
    if (cur && cur.itemId === item.id && !cur.error && !cur.loading) {
      if (cur.playing) {
        const ctx = ctxRef.current
        if (ctx && bufferRef.current) {
          offsetRef.current = Math.min(bufferRef.current.duration, offsetRef.current + (ctx.currentTime - startedAtRef.current))
        }
        stopSource()
        setState(prev => prev ? { ...prev, playing: false, currentTime: offsetRef.current } : prev)
      } else if (bufferRef.current) {
        const nextOffset = offsetRef.current >= bufferRef.current.duration - 0.05 ? 0 : offsetRef.current
        await startBuffer(bufferRef.current, nextOffset, handleEnded)
        setState(prev => prev ? { ...prev, playing: true, currentTime: nextOffset } : prev)
      }
      return
    }
    const reqId = ++reqRef.current
    stopSource()
    bufferRef.current = null
    offsetRef.current = 0
    setState({
      itemId: item.id,
      name: item.name,
      kind: item.audio.kind,
      iconUrl,
      tracks: [],
      index: 0,
      loading: true,
      playing: false,
      currentTime: 0,
      duration: 0,
      error: '',
    })
    try {
      await ensureContext()
      const res = await api.audioPreview(item.audio)
      if (reqRef.current !== reqId) return
      if (!res?.tracks?.length || !res.initial) {
        setState(prev => prev ? { ...prev, loading: false, error: res?.reason || 'Sem prévia disponível.' } : prev)
        return
      }
      const audioBuffer = await decodeTrack(res.initial.entry, res.initial)
      if (reqRef.current !== reqId) return
      const startIndex = res.initialIndex || 0
      const duration = await startBuffer(audioBuffer, 0, handleEnded)
      if (reqRef.current !== reqId) return
      setState(prev => prev ? {
        ...prev,
        tracks: res.tracks,
        index: startIndex,
        loading: false,
        playing: true,
        currentTime: 0,
        duration: duration || res.initial.duration || 0,
      } : prev)
    } catch (e) {
      if (reqRef.current !== reqId) return
      setState(prev => prev ? { ...prev, loading: false, playing: false, error: e.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') } : prev)
    }
  }, [api, decodeTrack, ensureContext, handleEnded, startBuffer, stopSource])

  const openVideo = useCallback(async (item, iconUrl = null) => {
    if (!api?.tauntPreview || !item?.audio) return openAudio(item, iconUrl)
    if (videoRef.current?.itemId === item.id) {
      videoReqRef.current++
      setVideo(null)
      return
    }
    reqRef.current++
    stopSource()
    bufferRef.current = null
    setState(null)
    const reqId = ++videoReqRef.current
    setVideo({ item, itemId: item.id, name: item.name, iconUrl, loading: true, url: null, kind: 'video', cached: false, error: '' })
    try {
      const res = await api.tauntPreview({ id: item.id, englishName: item.audio.englishName, name: item.name })
      if (videoReqRef.current !== reqId) return
      if (res?.url) {
        setVideo(prev => prev ? { ...prev, loading: false, url: res.url, kind: res.kind || 'video', cached: Boolean(res.cached), error: '' } : prev)
        return
      }
      // Fallback automático para o áudio local do VPK se o vídeo não existir na Wiki ou estiver offline
      setVideo(null)
      await openAudio(item, iconUrl)
    } catch {
      if (videoReqRef.current !== reqId) return
      setVideo(null)
      await openAudio(item, iconUrl)
    }
  }, [api, openAudio, stopSource])

  const open = useCallback((item, iconUrl = null) => {
    if (item?.audio?.kind === 'taunt' && api?.tauntPreview) return openVideo(item, iconUrl)
    return openAudio(item, iconUrl)
  }, [api, openAudio, openVideo])

  const closeVideo = useCallback(() => {
    videoReqRef.current++
    setVideo(null)
  }, [])

  const togglePlay = useCallback(async () => {
    const cur = stateRef.current
    if (!cur || cur.loading || !bufferRef.current) return
    if (cur.playing) {
      const ctx = ctxRef.current
      if (ctx) offsetRef.current = Math.min(bufferRef.current.duration, offsetRef.current + (ctx.currentTime - startedAtRef.current))
      stopSource()
      setState(prev => prev ? { ...prev, playing: false, currentTime: offsetRef.current } : prev)
    } else {
      const nextOffset = offsetRef.current >= bufferRef.current.duration - 0.05 ? 0 : offsetRef.current
      try {
        await startBuffer(bufferRef.current, nextOffset, handleEnded)
        setState(prev => prev ? { ...prev, playing: true, currentTime: nextOffset } : prev)
      } catch (e) {
        setState(prev => prev ? { ...prev, playing: false, error: e.message || 'Falha ao reproduzir.' } : prev)
      }
    }
  }, [handleEnded, startBuffer, stopSource])

  const seek = useCallback(async fraction => {
    const buf = bufferRef.current
    if (!buf || !buf.duration) return
    const nextOffset = clamp(fraction) * buf.duration
    offsetRef.current = nextOffset
    if (stateRef.current?.playing) {
      await startBuffer(buf, nextOffset, handleEnded)
    }
    setState(prev => prev ? { ...prev, currentTime: nextOffset } : prev)
  }, [handleEnded, startBuffer])

  const close = useCallback(() => {
    reqRef.current++
    stopSource()
    bufferRef.current = null
    setState(null)
  }, [stopSource])

  return { state, video, analyserRef, open, openAudio, togglePlay, selectTrack, seek, close, closeVideo }
}

function VideoMark({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <rect x="2.5" y="5" width="14" height="14" rx="3"/>
    <path d="M16.5 10l5-3v10l-5-3z" fill="currentColor" stroke="none"/>
  </svg>
}

export function AudioPreviewButton({ item, iconUrl, ctrl, compact = false }) {
  if (!item?.audio || !ctrl) return null
  const isTaunt = item.audio.kind === 'taunt'
  const activeVideo = isTaunt && ctrl.video?.itemId === item.id
  const activeAudio = ctrl.state?.itemId === item.id && ctrl.state?.playing
  const active = activeVideo || activeAudio
  const label = isTaunt ? (activeVideo ? 'Vendo' : activeAudio ? 'Tocando' : 'Vídeo') : (activeAudio ? 'Tocando' : 'Prévia')
  const title = isTaunt ? (activeVideo ? 'Fechar vídeo da provocação' : 'Ver prévia da provocação')
    : (activeAudio ? 'Pausar prévia de áudio' : 'Ouvir prévia de áudio')
  return <button type="button"
    className={'audio-preview-btn' + (compact ? ' compact' : '') + (active ? ' playing' : '')}
    title={title}
    aria-label={title + ' — ' + item.name}
    onClick={event => { event.stopPropagation(); ctrl.open(item, iconUrl) }}>
    {activeAudio ? <span className="mini-eq" aria-hidden="true"><i/><i/><i/></span>
      : isTaunt ? <VideoMark size={13}/> : <NotebookMark size={13}/>}
    <span>{label}</span>
  </button>
}

function TauntVideoDock({ ctrl }) {
  const video = ctrl?.video
  const mediaRef = useRef(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    setPaused(false)
    setMuted(false)
  }, [video?.itemId])

  function toggleVideo() {
    const el = mediaRef.current
    if (!el) return
    if (el.paused) { el.play().catch(() => {}); setPaused(false) }
    else { el.pause(); setPaused(true) }
  }

  return <AnimatePresence>
    {video && <motion.aside className="taunt-dock" aria-label="Prévia da provocação"
      initial={{ opacity: 0, y: 28, scale: 0.94, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 22, scale: 0.95, filter: 'blur(8px)' }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}>

      <div className="nlm-head">
        <span className="nlm-badge" aria-hidden="true"><VideoMark size={16}/></span>
        <div className="nlm-titles">
          <strong title={video.name}>{video.name}</strong>
          <small>{video.loading ? 'Buscando vídeo na Liquipedia…' : (video.cached ? 'Provocação · Cache local' : 'Provocação · Dota 2 Wiki')}</small>
        </div>
        <div className="nlm-controls">
          {video.url && video.kind === 'video' && <>
            <button type="button" className="nlm-ctrl" aria-label={muted ? 'Ativar som' : 'Silenciar'} title={muted ? 'Ativar som' : 'Silenciar'}
              onClick={() => setMuted(m => !m)}>
              {muted
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/></svg>}
            </button>
            <button type="button" className="nlm-ctrl nlm-play" aria-label={paused ? 'Reproduzir' : 'Pausar'} title={paused ? 'Reproduzir' : 'Pausar'}
              onClick={toggleVideo}>
              {paused
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.8v14.4a1 1 0 001.5.86l11.4-7.2a1 1 0 000-1.72L8.5 3.94A1 1 0 007 4.8z"/></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="3.8" height="14" rx="1.2"/><rect x="13.7" y="5" width="3.8" height="14" rx="1.2"/></svg>}
            </button>
          </>}
          <button type="button" className="nlm-ctrl" aria-label="Ouvir áudio do VPK" title="Ouvir áudio local do VPK"
            onClick={() => ctrl.openAudio(video.item, video.iconUrl)}>
            <NotebookMark size={13}/>
          </button>
          <button type="button" className="nlm-ctrl" aria-label="Fechar vídeo" title="Fechar vídeo" onClick={ctrl.closeVideo}>
            <Icon name="close"/>
          </button>
        </div>
      </div>

      <div className="taunt-stage">
        {video.loading && <div className="taunt-loading">
          <span className="taunt-spinner"/>
          <span>Carregando clipe…</span>
        </div>}
        {!video.loading && video.url && (video.kind === 'image'
          ? <img className="taunt-media" src={video.url} alt={video.name}/>
          : <video ref={mediaRef} className="taunt-media" src={video.url} autoPlay loop playsInline muted={muted}
              onClick={toggleVideo}/>)}
      </div>
    </motion.aside>}
  </AnimatePresence>
}

export function NotebookAudioDock({ ctrl, theme }) {
  const state = ctrl?.state
  const [wave, setWave] = useState(() => ({ bars: Array(31).fill(0.1), left: 0.25, right: 0.25, t: 0 }))
  const dark = theme === 'dark'

  useEffect(() => {
    if (!state) return
    let raf = 0
    const start = performance.now()
    const freq = new Uint8Array(64)
    const tick = now => {
      const t = (now - start) / 1000
      const playing = state.playing
      const loading = state.loading
      let energy = 0
      const bars = new Array(31)
      const analyser = ctrl.analyserRef?.current
      if (playing && analyser) {
        analyser.getByteFrequencyData(freq)
        for (let i = 0; i < 31; i++) {
          const bin = Math.min(freq.length - 1, Math.floor(i * 1.35) + 1)
          const raw = freq[bin] / 255
          const env = 0.55 + 0.45 * Math.abs(Math.sin(t * 5.2 + i * 0.45))
          const val = clamp(Math.max(raw * 1.18, 0.14 * env))
          bars[i] = val
          energy += raw
        }
        energy = clamp((energy / 31) * 1.85)
      } else if (playing || loading) {
        for (let i = 0; i < 31; i++) {
          const u = i / 30
          const sweep = loading ? Math.exp(-Math.pow(u - ((t * 0.8) % 1.4 - 0.2), 2) / 0.04) * 0.65 : 0
          const organic = loading ? 0.14 + sweep : clamp(0.18 + 0.72 * Math.abs(pseudoNoise(t * 4.4 + i * 0.78)))
          bars[i] = organic
        }
        energy = loading ? 0.45 : 0.72
      } else {
        for (let i = 0; i < 31; i++) bars[i] = 0.12
        energy = 0.08
      }
      const swing = 0.5 + 0.5 * Math.sin(t * 1.35)
      const left = playing ? clamp(0.45 + 0.55 * energy * (0.65 + 0.35 * swing)) : loading ? 0.45 : 0.2
      const right = playing ? clamp(0.45 + 0.55 * energy * (0.65 + 0.35 * (1 - swing))) : loading ? 0.45 : 0.2
      setWave({ bars, left, right, t })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [Boolean(state), state?.playing, state?.loading, ctrl?.analyserRef])

  const track = state?.tracks?.[state.index]
  const progress = state && state.duration > 0 ? clamp(state.currentTime / state.duration) : 0
  const caption = state?.error || (state?.loading ? 'Extraindo áudio do VPK…' : (track?.caption || track?.label || 'Prévia de áudio'))
  const subtitle = state ? (KIND_LABEL[state.kind] || 'Áudio') + (state.tracks.length > 1 ? ` · Faixa ${state.index + 1} de ${state.tracks.length}` : '') : ''
  const idleBarColor = dark ? '#242429' : '#d2d2d8'
  const accentColor = dark ? '#ff453a' : '#ff3b30'
  const initialLetter = (state?.name || 'D').trim().charAt(0).toUpperCase()

  return <><AnimatePresence>
    {state && <motion.aside className="nlm-dock" aria-label="Prévia de áudio"
      initial={{ opacity: 0, y: 28, scale: 0.94, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 22, scale: 0.95, filter: 'blur(8px)' }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}>

      <div className="nlm-head">
        <span className="nlm-badge" aria-hidden="true"><NotebookMark size={17}/></span>
        <div className="nlm-titles">
          <strong title={state.name}>{state.name}</strong>
          <small>{subtitle}</small>
        </div>
        <div className="nlm-controls">
          {state.tracks.length > 1 && <>
            <button type="button" className="nlm-ctrl" aria-label="Faixa anterior" title="Faixa anterior"
              onClick={() => ctrl.selectTrack(state.index - 1)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18 5v14L8 12z"/><rect x="5" y="5" width="2.4" height="14" rx="1"/></svg>
            </button>
            <button type="button" className="nlm-ctrl" aria-label="Próxima faixa" title="Próxima faixa"
              onClick={() => ctrl.selectTrack(state.index + 1)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5v14l10-7z"/><rect x="16.6" y="5" width="2.4" height="14" rx="1"/></svg>
            </button>
          </>}
          <button type="button" className="nlm-ctrl nlm-play" disabled={state.loading || Boolean(state.error)}
            aria-label={state.playing ? 'Pausar' : 'Reproduzir'} title={state.playing ? 'Pausar' : 'Reproduzir'}
            onClick={ctrl.togglePlay}>
            {state.playing
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="3.8" height="14" rx="1.2"/><rect x="13.7" y="5" width="3.8" height="14" rx="1.2"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.8v14.4a1 1 0 001.5.86l11.4-7.2a1 1 0 000-1.72L8.5 3.94A1 1 0 007 4.8z"/></svg>}
          </button>
          <button type="button" className="nlm-ctrl" aria-label="Fechar prévia" title="Fechar prévia" onClick={ctrl.close}>
            <Icon name="close"/>
          </button>
        </div>
      </div>

      <div className="nlm-stage" aria-hidden="true">
        <div className="nlm-orb">
          {[0, 0.5].map((off, j) => {
            const u = (wave.t * 1.05 + off) % 1
            return <i key={j} className="nlm-ring" style={{ opacity: ((1 - u) * 0.72 * wave.left).toFixed(3), transform: `scale(${(1 + u * 0.58).toFixed(3)})` }}/>
          })}
          <i className="nlm-glow" style={{ opacity: wave.left.toFixed(3) }}/>
          <span className="nlm-avatar nlm-avatar-a">
            {state.iconUrl ? <img src={state.iconUrl} alt=""/> : initialLetter}
          </span>
        </div>

        <div className="nlm-wave">
          {wave.bars.map((val, i) => {
            const u = i / 30
            const weight = wave.left * Math.exp(-u * 2.2) + wave.right * Math.exp(-(1 - u) * 2.2)
            const h = 3 + 23 * clamp(val * (0.45 + 0.75 * weight))
            const color = hexMix(idleBarColor, accentColor, clamp(val * 1.15 + weight * 0.35))
            return <i key={i} style={{ height: `${h.toFixed(1)}px`, background: color }}/>
          })}
        </div>

        <div className="nlm-orb">
          {[0.25, 0.75].map((off, j) => {
            const u = (wave.t * 1.05 + off) % 1
            return <i key={j} className="nlm-ring" style={{ opacity: ((1 - u) * 0.65 * wave.right).toFixed(3), transform: `scale(${(1 + u * 0.55).toFixed(3)})` }}/>
          })}
          <i className="nlm-glow" style={{ opacity: wave.right.toFixed(3) }}/>
          <span className="nlm-avatar nlm-avatar-b">
            <NotebookMark size={14}/>
          </span>
        </div>
      </div>

      <div className="nlm-caption-wrap">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={caption} className={'nlm-caption' + (state.error ? ' error' : '')}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}>
            {caption}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="nlm-foot">
        <div className="nlm-scrubber" role="slider" aria-label="Progresso do áudio"
          aria-valuemin={0} aria-valuemax={Math.round(state.duration || 0)} aria-valuenow={Math.round(state.currentTime || 0)}
          tabIndex={0}
          onClick={event => {
            const rect = event.currentTarget.getBoundingClientRect()
            ctrl.seek((event.clientX - rect.left) / rect.width)
          }}>
          <div className="nlm-track">
            <div className="nlm-fill" style={{ transform: `translateX(${((progress - 1) * 100).toFixed(2)}%)` }}/>
          </div>
          <i className="nlm-thumb" style={{ left: `${(progress * 100).toFixed(2)}%` }}/>
        </div>
        <span className="nlm-time">
          <strong>{formatTime(state.currentTime)}</strong>
          <span> / {formatTime(state.duration)}</span>
        </span>
      </div>
    </motion.aside>}
  </AnimatePresence>
  <TauntVideoDock ctrl={ctrl}/></>
}
