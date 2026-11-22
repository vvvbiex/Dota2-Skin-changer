import React, { useMemo } from 'react'
import { ItemArt, rarityKey, rarityNames, useIcons } from './ItemArt.jsx'
import { attributes, Icon, Portrait, slotGlyph, slotName } from './ui.jsx'

export function Hero({ hero, visibleSlots, selected, busy, showEmpty, onShowEmpty, onSlot, onStyle, onClear, onBack }) {
  const [attribute, , color] = attributes.find(([name]) => name === hero.attribute) || attributes.at(-1)
  const slots = useMemo(() => visibleSlots.map(slot => {
    const choice = selected.get(slot.id)
    return { slot, choice, item: slot.items.find(item => item.id === String(choice?.itemId)) }
  }), [visibleSlots, selected])
  const images = useMemo(() => slots.flatMap(({ item }) => item ? [item] : []), [slots])
  const icons = useIcons(images)
  return <>
    <div className="breadcrumb-bar">
      <div className="breadcrumbs" aria-label="Localização no catálogo">
        <button type="button" onClick={onBack}>Catálogo</button><span aria-hidden="true">›</span>
        <span>Heróis</span><span aria-hidden="true">›</span><strong>{hero.name}</strong>
      </div>
      <button type="button" className="back-button" onClick={onBack}><Icon name="back"/> Voltar</button>
    </div>
    <section className="hero-heading" data-attribute={color} aria-labelledby="hero-title">
      <div className="hero-attribute"><Icon name={color === 'unknown' ? 'diamond' : color}/>{attribute}</div>
      <h2 id="hero-title">{hero.name}</h2>
      <Portrait key={hero.id} hero={hero} eager/>
      <button type="button" className="text-button" disabled={busy || !selected.size} onClick={onClear}>
        <Icon name="reset"/> Limpar skins do herói
      </button>
    </section>
    <section className="gear-section" aria-labelledby="gear-title">
      <div className="section-bar gear-bar">
        <h2 id="gear-title">Slots de equipamento</h2>
        <label className="checkbox-label">
          <input type="checkbox" checked={showEmpty} onChange={event => onShowEmpty(event.target.checked)}/> Mostrar slots vazios
        </label>
      </div>
      <div className="slot-grid">{slots.map(({ slot, choice, item }) => {
        const rarity = rarityKey(item?.rarity)
        return <article className="slot-card" key={slot.id} data-equipped={Boolean(item)} data-rarity={rarity}>
          <button type="button" className="slot-button" aria-haspopup="dialog" aria-label={slotName(slot.id)}
            disabled={busy} onClick={() => onSlot(slot.id)}>
            <span className="slot-title">{slot.id.replaceAll('_', ' ')}</span>
            <span className="slot-visual">
              {item ? <ItemArt item={item} icon={icons.get(item.image)}/> : <Icon name={slotGlyph(slot.id)} className="slot-glyph"/>}
              {item && <span className="equipped-check" title="Equipado"><Icon name="check"/></span>}
            </span>
            <span className="slot-caption">
              <strong>{item?.name || (choice ? 'Item ausente' : 'Padrão')}</strong>
              {item ? <small className="rarity-text">{rarityNames[rarity]}</small> :
                <small>{slot.items.length} {slot.items.length === 1 ? 'item' : 'itens'}</small>}
            </span>
          </button>
          {item?.styles.length > 0 && <select aria-label={'Estilo de ' + item.name} disabled={busy}
            value={choice.styleId ?? (item.styles.find(style => style.id === '0') || item.styles[0]).id}
            onChange={event => onStyle(slot.id, item.id, event.target.value)}>
            {item.styles.map(style => <option key={style.id} value={style.id}>{Number(style.id) + 1} · {style.name}</option>)}
          </select>}
        </article>
      })}</div>
      {!slots.length && <p className="empty-message">Nenhum slot com itens disponíveis.</p>}
    </section>
  </>
}
