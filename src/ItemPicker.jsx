import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ItemArt, rarityKey, rarityNames, rarityOrder, useIcons } from './ItemArt.jsx'
import { fold, globalName, Icon, Search, slotGlyph, slotName } from './ui.jsx'

const pageSize = 24
const sortOptions = [
  ['rare-first', 'Por raridade'], ['common-first', 'Mais comum → Mais rara'], ['name', 'Nome A–Z'],
]
const filterLabels = {
  arcana: 'Arcana', immortal: 'Immortal', legendary: 'Legendary', mythical: 'Mythical', rare: 'Rare',
  uncommon: 'Uncommon', common: 'Common', ancient: 'Ancient', seasonal: 'Seasonal', other: 'Outros',
}
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' })
const rank = rarity => {
  const index = rarityOrder.indexOf(rarity)
  return index === -1 ? rarityOrder.length : index
}

export function ItemPicker({ owner, slots, slot, selected, busy, onSlot, onChange, onClose }) {
  const dialog = useRef(null)
  const results = useRef(null)
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState('')
  const [sort, setSort] = useState('rare-first')
  const [page, setPage] = useState(0)
  const nameFor = owner.id === 'global' ? globalName : slotName
  const selectedId = selected.get(slot.id)?.itemId
  const levels = useMemo(() => {
    const available = new Set(slot.items.map(item => rarityKey(item.rarity)))
    return Object.keys(rarityNames).filter(level => available.has(level))
  }, [slot.items])
  const matching = useMemo(() => {
    const normalized = fold(query.trim())
    return slot.items.filter(item => (!rarity || rarityKey(item.rarity) === rarity) && fold(item.name).includes(normalized))
      .sort((a, b) => {
        const byRank = rank(a.rarity) - rank(b.rarity)
        const difference = sort === 'name' ? 0 : sort === 'common-first' ? -byRank : byRank
        return difference || collator.compare(a.name, b.name)
      })
  }, [query, rarity, sort, slot.items])
  const displayed = useMemo(() => matching.slice(page * pageSize, (page + 1) * pageSize), [matching, page])
  const icons = useIcons(displayed)
  const pages = Math.ceil(matching.length / pageSize)
  const canSelect = slot.defaultId || slot.scopedDefault
  useLayoutEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  useLayoutEffect(() => { results.current.scrollTop = 0 }, [slot, page, query, rarity, sort])

  function changeSlot(id) {
    if (id === slot.id) return
    setQuery('')
    setRarity('')
    setPage(0)
    onSlot(id)
  }
  return <dialog ref={dialog} className="picker-panel" aria-labelledby="picker-title"
    onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="picker-header">
      <div><small>{owner.name}</small><h2 id="picker-title">{nameFor(slot.id)}</h2></div>
      <button type="button" className="icon-button" aria-label="Fechar seletor" title="Fechar seletor" onClick={onClose}><Icon name="close"/></button>
    </div>
    <div className="picker-controls">
      <Search label="Buscar item" value={query} autoFocus onChange={value => { setQuery(value); setPage(0) }}/>
      <div className="segments picker-sort" role="group" aria-label="Ordenar por">
        {sortOptions.map(([id, label]) => <button key={id} type="button" aria-pressed={sort === id}
          onClick={() => { setSort(id); setPage(0) }}>{label}</button>)}
      </div>
      <span className="item-count" aria-live="polite">{matching.length} {matching.length === 1 ? 'item' : 'itens'}</span>
    </div>
    {slot.reason && <p className="picker-note">{slot.reason}</p>}
    <div className="picker-body">
      <div className="picker-rail slot-rail" role="group" aria-label={owner.id === 'global' ? 'Categorias globais' : 'Troca rápida de slots'}>
        <h3>{owner.id === 'global' ? 'Categorias' : 'Slots'}</h3>
        {slots.map(other => <button key={other.id} type="button" aria-pressed={other.id === slot.id}
          onClick={() => changeSlot(other.id)} title={nameFor(other.id)}>
          <Icon name={slotGlyph(other.id)}/><span>{nameFor(other.id)}</span>
          {selected.has(other.id) && <span className="rail-dot" aria-label="Alterado"/>}
        </button>)}
      </div>
      <div className="picker-center">
        <div className="picker-results" ref={results}>
          <div className="item-grid">
            <button type="button" className="item-tile default-tile" aria-pressed={selectedId == null}
              disabled={busy} onClick={() => onChange('')}>
              <span className="tile-art"><Icon name="reset"/></span>
              <span className="tile-caption"><strong>Padrão / Não modificar</strong></span>
              {selectedId == null && <span className="equipped-check" title="Padrão ativo"><Icon name="check"/></span>}
            </button>
            {displayed.map(item => {
              const rarity = rarityKey(item.rarity)
              const active = String(selectedId) === item.id
              return <button key={item.id} type="button" className="item-tile" data-rarity={rarity}
                aria-pressed={active} disabled={busy || !canSelect} onClick={() => onChange(item.id)}>
                <span className="tile-art"><ItemArt item={item} icon={icons.get(item.image)}/></span>
                {active ? <span className="equipped-check" title="Equipado"><Icon name="check"/></span>
                  : <span className="equip-action" title="Equipar"><Icon name="plus"/></span>}
                <span className="tile-caption"><small className="rarity-text">{rarityNames[rarity]}</small><strong>{item.name}</strong></span>
              </button>
            })}
          </div>
          {!matching.length && <p className="empty-message">Nenhum item encontrado.</p>}
        </div>
        {pages > 1 && <div className="pager">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}><Icon name="back"/> Anterior</button>
          <small>{page + 1} / {pages}</small>
          <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Próxima <Icon name="forward"/></button>
        </div>}
      </div>
      <div className="picker-rail rarity-rail" role="group" aria-label="Filtrar por raridade">
        <h3>Raridade</h3>
        <button type="button" aria-pressed={!rarity} title="Todas as raridades" onClick={() => { setRarity(''); setPage(0) }}>All</button>
        {levels.map(level => <button key={level} type="button" data-rarity={level} aria-pressed={rarity === level}
          title={rarityNames[level]} onClick={() => { setRarity(level); setPage(0) }}>
          <Icon name="diamond"/><span>{filterLabels[level]}</span>
        </button>)}
      </div>
    </div>
  </dialog>
}
