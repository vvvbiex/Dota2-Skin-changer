import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DefaultArt, defaultImage, ItemArt, rarityKey, rarityNames, rarityOrder, StyleOptions, useIcons } from './ItemArt.jsx'
import { SegmentedControl } from './MotionUI.jsx'
import { fold, globalName, Icon, Search, slotGlyph, slotName } from './ui.jsx'

const pageSize = 24
const sortOptions = [
  { id: 'rare-first', label: 'Por raridade' },
  { id: 'common-first', label: 'Mais comum → Mais rara' },
  { id: 'name', label: 'Nome A–Z' },
]
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' })
const rank = rarity => {
  const index = rarityOrder.indexOf(rarity)
  return index === -1 ? rarityOrder.length : index
}

export function ItemPicker({ owner, slots, slot, selected, busy, onSlot, onChange, onClose }) {
  const dialog = useRef(null)
  const results = useRef(null)
  const closeTimer = useRef(null)
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState('')
  const [sort, setSort] = useState('rare-first')
  const [page, setPage] = useState(0)
  const [closing, setClosing] = useState(false)
  const global = owner.id === 'global'
  const nameFor = global ? globalName : slotName
  const choice = selected.get(slot.id)
  const selectedId = choice?.itemId
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
  const image = defaultImage(slot)
  const images = useMemo(() => [...displayed, { image }], [displayed, image])
  const icons = useIcons(images)
  const pages = Math.ceil(matching.length / pageSize)
  const canSelect = slot.defaultId || slot.scopedDefault
  useLayoutEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => {
      clearTimeout(closeTimer.current)
      element.close()
    }
  }, [])
  useLayoutEffect(() => { results.current.scrollTop = 0 }, [slot, page, query, rarity, sort])

  function changeSlot(id) {
    if (id === slot.id) return
    setQuery('')
    setRarity('')
    setPage(0)
    onSlot(id)
  }
  function requestClose() {
    if (closeTimer.current !== null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    setClosing(true)
    closeTimer.current = setTimeout(onClose, 160)
  }
  return <dialog ref={dialog} className="picker-panel" aria-labelledby="picker-title" data-global={global} data-closing={closing}
    onAnimationEnd={event => {
      if (event.target === event.currentTarget && event.animationName === 'picker-exit') onClose()
    }}
    onCancel={event => { event.preventDefault(); requestClose() }}>
    <div className="picker-header">
      <div><small>{owner.name}</small><h2 id="picker-title">{nameFor(slot.id)}</h2></div>
      <button type="button" className="icon-button" aria-label="Fechar seletor" title="Fechar seletor" onClick={requestClose}><Icon name="close"/></button>
    </div>
    <div className="picker-controls">
      <Search label="Buscar item" value={query} autoFocus onChange={value => { setQuery(value); setPage(0) }}/>
      <SegmentedControl label="Ordenar por" layoutId="picker-sort" className="segments picker-sort"
        options={sortOptions} value={sort} onChange={id => { setSort(id); setPage(0) }}/>
      <span className="item-count" aria-live="polite">{matching.length} {matching.length === 1 ? 'item' : 'itens'}</span>
    </div>
    {slot.reason && <p className="picker-note">{slot.reason}</p>}
    <div className="picker-body">
      <div className="picker-rail slot-rail" role="group" aria-label={global ? 'Categorias globais' : 'Troca rápida de equipamentos'}>
        <h3>{global ? 'Categorias' : 'Equipamentos'}</h3>
        {slots.map(other => <button key={other.id} type="button" aria-pressed={other.id === slot.id}
          onClick={() => changeSlot(other.id)} title={nameFor(other.id)}>
          <Icon name={slotGlyph(other.id)}/><span>{nameFor(other.id)}</span>
          {selected.has(other.id) && <span className="rail-dot" aria-label="Alterado"/>}
        </button>)}
      </div>
      <div className="picker-center">
        <div className="picker-results" ref={results}>
          <div className="item-grid view-entry" key={slot.id}>
            <button type="button" className="item-tile default-tile" aria-pressed={selectedId == null}
              disabled={busy} onClick={() => onChange('')}>
              <span className="tile-art"><DefaultArt slot={slot} icon={icons.get(image)}/></span>
              <span className="tile-caption"><strong>Padrão / Não modificar</strong></span>
              {selectedId == null && <span className="equipped-check" title="Padrão ativo"><Icon name="check"/></span>}
            </button>
            {displayed.map(item => {
              const rarity = rarityKey(item.rarity)
              const active = String(selectedId) === item.id
              return <article key={item.id} className="picker-item" data-rarity={rarity} data-equipped={active}>
                <button type="button" className="item-tile" aria-pressed={active} disabled={busy || !canSelect} onClick={() => onChange(item.id)}>
                  <span className="tile-art"><ItemArt item={item} icon={icons.get(item.image)}/></span>
                  {active ? <span className="equipped-check" title="Equipado"><Icon name="check"/></span>
                    : <span className="equip-action" title="Equipar"><Icon name="plus"/></span>}
                  <span className="tile-caption"><small className="rarity-text">{rarityNames[rarity]}</small><strong>{item.name}</strong></span>
                </button>
                <StyleOptions item={item} choice={active ? choice : null} disabled={busy || !canSelect}
                  onChange={styleId => onChange(item.id, styleId)}/>
              </article>
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
        <button type="button" aria-pressed={!rarity} title="Todas as raridades" onClick={() => { setRarity(''); setPage(0) }}>Todas</button>
        {levels.map(level => <button key={level} type="button" data-rarity={level} aria-pressed={rarity === level}
          title={rarityNames[level]} onClick={() => { setRarity(level); setPage(0) }}>
          <Icon name="diamond"/><span>{rarityNames[level]}</span>
        </button>)}
      </div>
    </div>
  </dialog>
}
