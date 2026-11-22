import React, { useMemo } from 'react'
import { ItemArt, rarityKey, rarityNames, useIcons } from './ItemArt.jsx'
import { Icon, slotName } from './ui.jsx'

export function Presets({ owners, choices, presets, presetName, setPresetName, store, busy, onSave, onLoad, onRemove, onExport, onImport }) {
  const { current, saved, items } = useMemo(() => {
    const byOwner = new Map(owners.map(owner => [owner.id, owner]))
    const items = []
    function resolve(selections) {
      return selections.map(choice => {
        const owner = byOwner.get(choice.hero)
        const slot = owner?.slots.find(slot => slot.id === choice.slot)
        const item = slot?.items.find(item => item.id === String(choice.itemId))
        if (item) items.push(item)
        const style = item?.styles.find(style => style.id === String(choice.styleId))
        return { choice, owner, item, style }
      })
    }
    return { current: resolve(choices), saved: presets.map(pack => ({ pack, rows: resolve(pack.selections) })), items }
  }, [owners, choices, presets])
  const icons = useIcons(items)
  function rows(entries, removable = false) {
    return entries.map(({ choice, owner, item, style }) => {
      const rarity = rarityKey(item?.rarity)
      const art = item || { name: 'Item ' + choice.itemId }
      return <div className="pack-item" key={choice.hero + '/' + choice.slot} data-rarity={rarity}>
        <ItemArt item={art} icon={icons.get(item?.image)}/>
        <div className="pack-item-details">
          <small>{owner?.name || choice.hero} · {slotName(choice.slot)}</small>
          <strong>{art.name}</strong>
          {style && <small>{style.name}</small>}
          {item ? <span className="rarity-badge">{rarityNames[rarity]}</span> :
            owners.length > 0 && <small>Ausente do catálogo</small>}
        </div>
        {removable && <button type="button" className="icon-button" aria-label={'Remover ' + art.name} title="Remover"
          disabled={busy} onClick={() => onRemove(choice)}><Icon name="close"/></button>}
      </div>
    })
  }
  return <>
    <form className="panel pack-tools" onSubmit={event => { event.preventDefault(); onSave() }}>
      <input aria-label="Nome do pack" placeholder="Nome do pack" maxLength="80" value={presetName} onChange={event => setPresetName(event.target.value)}/>
      <button className="primary" disabled={busy || !presetName.trim()}>{presets.some(p => p.name === presetName.trim()) ? 'Atualizar Pack' : 'Salvar Pack'}</button>
      <button type="button" disabled={busy} onClick={onImport}><Icon name="download"/> Importar Pack (.json)</button>
    </form>
    <div className="pack-layout">
      <section aria-labelledby="current-title">
        <div className="section-bar"><h2 id="current-title">Seleção atual</h2><small>{current.length} {current.length === 1 ? 'slot' : 'slots'}</small></div>
        <div className="panel pack-list">
          {current.length ? rows(current, true) : <p className="empty-message">Nenhum slot selecionado.</p>}
        </div>
      </section>
      <section aria-labelledby="saved-title">
        <div className="section-bar"><h2 id="saved-title">Packs salvos</h2><small>{saved.length} {saved.length === 1 ? 'pack' : 'packs'}</small></div>
        {saved.length ? saved.map(({ pack, rows: entries }) => <article className="panel pack" key={pack.name}>
          <div className="pack-header">
            <div><h3>{pack.name}</h3><small>{entries.length} {entries.length === 1 ? 'slot' : 'slots'}</small></div>
            <div className="pack-actions">
              <button type="button" disabled={busy} onClick={() => onLoad(pack)}>Carregar</button>
              <button type="button" disabled={busy} onClick={() => onExport(pack)}>Exportar Pack (.json)</button>
            </div>
          </div>
          {rows(entries)}
        </article>) : <p className="panel empty-message">Nenhum pack salvo.</p>}
      </section>
    </div>
    {store && <p className="path data-path">{store}</p>}
  </>
}
