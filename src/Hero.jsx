import React, { useMemo } from 'react'
import { AttributeArt, DefaultArt, defaultImage, ItemArt, rarityKey, rarityNames, StyleOptions, useIcons } from './ItemArt.jsx'
import { AudioPreviewButton } from './MotionUI.jsx'
import { attributes, Icon, Portrait, slotName } from './ui.jsx'

export function Hero({ hero, attributeIcon, visibleSlots, selected, busy, showEmpty, audio, onShowEmpty, onSlot, onStyle, onEquipSet, onClear, onBack }) {
  const [attribute, , color] = attributes.find(([name]) => name === hero.attribute) || attributes.at(-1)
  const itemsById = useMemo(() => new Map(hero.slots.flatMap(slot => slot.items.map(item => [item.id, item]))), [hero.slots])
  const slots = useMemo(() => visibleSlots.map(slot => {
    const choice = selected.get(slot.id)
    return { slot, choice, item: slot.items.find(item => item.id === String(choice?.itemId)) }
  }), [visibleSlots, selected])
  const images = useMemo(() => [
    ...slots.map(({ slot, item }) => item || { image: defaultImage(slot) }),
    ...(hero.sets || []).map(set => ({ image: set.iconPath })),
  ], [slots, hero.sets])
  const icons = useIcons(images)
  return <>
    <div className="breadcrumb-bar">
      <div className="breadcrumbs" aria-label="Localização no catálogo">
        <button type="button" onClick={onBack}>Catálogo</button><span aria-hidden="true">›</span>
        <span>Heróis</span><span aria-hidden="true">›</span><strong>{hero.name}</strong>
      </div>
      <button type="button" className="back-button" onClick={onBack}><Icon name="back"/> Voltar</button>
    </div>
    <section className="hero-heading view-entry" data-attribute={color} aria-labelledby="hero-title">
      <div className="hero-attribute"><AttributeArt attribute={color} icon={attributeIcon}/>{attribute}</div>
      <h2 id="hero-title">{hero.name}</h2>
      <Portrait key={hero.id} hero={hero} eager/>
      <button type="button" className="text-button" disabled={busy || !selected.size} onClick={onClear}>
        <Icon name="reset"/> Limpar cosméticos do herói
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
        const itemIcon = item ? icons.get(item.image) : null
        return <article className="slot-card" key={slot.id} data-equipped={Boolean(item)} data-rarity={rarity}>
          {item?.audio && <AudioPreviewButton item={item} iconUrl={itemIcon?.url} ctrl={audio} compact/>}
          <button type="button" className="slot-button" aria-haspopup="dialog" aria-label={slotName(slot.id)}
            disabled={busy} onClick={() => onSlot(slot.id)}>
            <span className="slot-title">{slotName(slot.id)}</span>
            <span className="slot-visual">
              {item ? <ItemArt item={item} icon={itemIcon}/> : <DefaultArt slot={slot} icon={icons.get(defaultImage(slot))}/>}
              {item && <span className="equipped-check" title="Equipado"><Icon name="check"/></span>}
            </span>
            <span className="slot-caption">
              <strong>{item?.name || (choice ? 'Item ausente' : 'Padrão')}</strong>
              {item ? <small className="rarity-text">{rarityNames[rarity]}</small> :
                <small>{slot.items.length} {slot.items.length === 1 ? 'item' : 'itens'}</small>}
            </span>
          </button>
          {item && <StyleOptions item={item} choice={choice} disabled={busy} onChange={styleId => onStyle(slot.id, item.id, styleId)}/>}
        </article>
      })}</div>
      {!slots.length && <p className="empty-message">Nenhum slot com itens disponíveis.</p>}
    </section>
    <section className="gear-section" aria-labelledby="sets-title">
      <div className="section-bar gear-bar"><h2 id="sets-title">Conjuntos</h2></div>
      {hero.sets?.length ? <div className="set-grid">{hero.sets.map(set => {
        const pieces = new Map()
        for (const { slot, itemId } of set.items) if (!pieces.has(slot)) pieces.set(slot, itemId)
        const equipped = [...pieces].every(([slot, itemId]) => String(selected.get(slot)?.itemId) === itemId)
        const rarity = rarityKey(set.rarity)
        const audioPiece = [...pieces.values()].map(id => itemsById.get(id)).find(it => it?.audio)
        const setIcon = icons.get(set.iconPath)
        return <article key={set.id} className="set-card" data-rarity={rarity}>
          {audioPiece && <AudioPreviewButton item={{ ...audioPiece, name: set.name }} iconUrl={setIcon?.url} ctrl={audio} compact/>}
          <ItemArt item={{ name: set.name, image: set.iconPath }} icon={setIcon}/>
          <div className="set-details">
            <small className="rarity-text">{rarityNames[rarity]} · {pieces.size} {pieces.size === 1 ? 'peça' : 'peças'}</small>
            <h3>{set.name}</h3>
            <button type="button" disabled={busy || equipped} onClick={() => onEquipSet(set.id)}>
              <Icon name={equipped ? 'check' : 'plus'}/>{equipped ? 'Conjunto equipado' : 'Equipar conjunto'}
            </button>
          </div>
        </article>
      })}</div> : <p className="empty-message">Nenhum conjunto disponível para este herói.</p>}
    </section>
  </>
}
