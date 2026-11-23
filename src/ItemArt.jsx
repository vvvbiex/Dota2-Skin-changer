import React, { useEffect, useMemo, useState } from 'react'
import { Icon, slotGlyph } from './ui.jsx'

export const rarityOrder = ['arcana', 'immortal', 'legendary', 'mythical', 'rare', 'uncommon', 'common']
export const rarityNames = {
  arcana: 'Arcana', immortal: 'Imortal', legendary: 'Lendário', mythical: 'Mítico', rare: 'Raro',
  uncommon: 'Incomum', common: 'Comum', ancient: 'Ancestral', seasonal: 'Sazonal', other: 'Padrão / Outros',
}
export const rarityKey = rarity => Object.hasOwn(rarityNames, rarity) ? rarity : 'other'
export const isIndexingIcons = ({ phase }) => ['verificando', 'preparando', 'convertendo', 'salvando'].includes(phase)
export const defaultImage = slot => slot.defaultIconPath === 'econ/default_no_item' ? null : slot.defaultIconPath

export function useAttributeIcons(paths, cli) {
  const source = useMemo(() => ({ paths, cli }), [paths, cli])
  const images = useMemo(() => Object.values(paths || {}).map(image => ({ image })), [paths])
  return useIcons(images, source)
}

export function AttributeArt({ attribute, icon }) {
  const [failedLocal, setFailedLocal] = useState(null)
  const [failedRemote, setFailedRemote] = useState(false)
  const local = icon?.url && icon.url !== failedLocal
  const remote = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_' + attribute + '.png'
  if (attribute === 'unknown' || (!local && failedRemote)) return null
  return <img className="attribute-art" src={local ? icon.url : remote} alt=""
    onError={() => local ? setFailedLocal(icon.url) : setFailedRemote(true)}/>
}

export function DefaultArt({ slot, icon }) {
  const [failed, setFailed] = useState(null)
  return icon?.url && icon.url !== failed
    ? <img className="default-art" src={icon.url} alt="" decoding="async" onError={() => setFailed(icon.url)}/>
    : <Icon name={slotGlyph(slot.id)} className="slot-glyph"/>
}

export function StyleOptions({ item, choice, disabled, onChange }) {
  if (!item.styles || item.styles.length < 2) return null
  const fallback = item.styles.find(style => style.id === '0') || item.styles[0]
  const current = choice && (item.styles.find(style => style.id === String(choice.styleId)) || fallback)
  return <div className="style-options" role="group" aria-label={'Estilos de ' + item.name}>
    {item.styles.map((style, index) => {
      const label = 'Estilo ' + (index + 1)
      return <button key={style.id} type="button" title={style.name} aria-label={label + ' · ' + style.name}
        aria-pressed={style === current} disabled={disabled} onClick={() => { if (style !== current) onChange(style.id) }}>{label}</button>
    })}
  </div>
}

export function useIcons(items, source) {
  const cache = useMemo(() => new Map(), [source])
  const [snapshot, setSnapshot] = useState(null)
  useEffect(() => {
    let active = true
    const missing = [...new Set(items.map(item => item.image).filter(Boolean))].filter(image => !cache.has(image))
    function publish(results) {
      if (!active) return
      for (const [image, result] of Object.entries(results)) cache.set(image, result)
      setSnapshot({ cache, icons: new Map(cache) })
    }
    async function load() {
      if (!missing.length) return
      try {
        const ready = await window.arsenal.cachedIcons(missing)
        if (!active) return
        publish(ready)
        const remaining = missing.filter(image => !Object.hasOwn(ready, image))
        if (!remaining.length) return
        const results = await window.arsenal.icons(remaining)
        publish(Object.fromEntries(remaining.map(image => [image, results[image] ?? { reason: 'Ícone indisponível.' }])))
      } catch {
        publish(Object.fromEntries(missing.filter(image => !cache.has(image)).map(image => [image, { reason: 'Ícone indisponível.' }])))
      }
    }
    void load()
    return () => { active = false }
  }, [cache, items])
  return snapshot?.cache === cache ? snapshot.icons : cache
}

export function ItemArt({ item, icon }) {
  const [failedUrl, setFailedUrl] = useState(null)
  return <span className={'item-art' + (item.image && !icon ? ' skeleton' : '')} title={icon?.reason}>
    {icon?.url && icon.url !== failedUrl ? <img src={icon.url} alt="" decoding="async" onError={() => setFailedUrl(icon.url)}/> :
      (!item.image || icon) && <span aria-hidden="true">{item.name.slice(0, 2).toUpperCase()}</span>}
  </span>
}
