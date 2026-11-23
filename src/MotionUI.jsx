import React, { useEffect, useRef, useState } from 'react'
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
