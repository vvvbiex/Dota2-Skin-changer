import React, { useEffect, useRef, useState } from 'react'

export const rarityOrder = ['arcana', 'immortal', 'legendary', 'mythical', 'rare', 'uncommon', 'common']
export const rarityNames = {
  arcana: 'Arcana', immortal: 'Imortal', legendary: 'Lendário', mythical: 'Mítico', rare: 'Raro',
  uncommon: 'Incomum', common: 'Comum', ancient: 'Ancestral', seasonal: 'Sazonal', other: 'Padrão / Outros',
}
export const rarityKey = rarity => Object.hasOwn(rarityNames, rarity) ? rarity : 'other'

export function useIcons(items) {
  const [icons, setIcons] = useState(() => new Map())
  const cache = useRef(new Map())
  useEffect(() => {
    let active = true
    const missing = [...new Set(items.map(item => item.image).filter(Boolean))].filter(image => !cache.current.has(image))
    function publish(results) {
      if (!active) return
      for (const [image, result] of Object.entries(results)) cache.current.set(image, result)
      setIcons(new Map(cache.current))
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
        publish(Object.fromEntries(missing.filter(image => !cache.current.has(image)).map(image => [image, { reason: 'Ícone indisponível.' }])))
      }
    }
    void load()
    return () => { active = false }
  }, [items])
  return icons
}

export function ItemArt({ item, icon }) {
  const [failedUrl, setFailedUrl] = useState(null)
  return <span className={'item-art' + (item.image && !icon ? ' skeleton' : '')} title={icon?.reason}>
    {icon?.url && icon.url !== failedUrl ? <img src={icon.url} alt="" decoding="async" onError={() => setFailedUrl(icon.url)}/> :
      (!item.image || icon) && <span aria-hidden="true">{item.name.slice(0, 2).toUpperCase()}</span>}
  </span>
}
