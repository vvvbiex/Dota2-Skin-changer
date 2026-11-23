import React, { useMemo, useState } from 'react'
import { AttributeArt, ItemArt, rarityKey, useIcons } from './ItemArt.jsx'
import { attributes, compareGlobalSlots, fold, globalName, Icon, isGlobalVisible, Portrait, Search, slotGlyph } from './ui.jsx'

const views = [['all', 'Todos'], ['heroes', 'Heróis'], ['globals', 'Globais']]
const filters = [['all', 'Todos'], ['changed', 'Alterados'], ['unchanged', 'Sem alterações']]
const filterRows = (rows, filter, changed) => rows.filter(row =>
  filter === 'all' || changed.has(row.id) === (filter === 'changed'))

function Segments({ label, options, counts, value, onChange, className = '' }) {
  return <div className={'segments ' + className} role="group" aria-label={label}>
    {options.map(([id, name]) => <button key={id} type="button" aria-pressed={id === value} onClick={() => onChange(id)}>
      {name}<span className="segment-count">{counts[id]}</span>
    </button>)}
  </div>
}

function SectionControls({ title, rows, changed, filter, setFilter }) {
  const count = rows.filter(row => changed.has(row.id)).length
  return <div className="section-bar">
    <h2>{title}</h2>
    <Segments label={'Filtrar ' + title.toLowerCase()} options={filters} value={filter} onChange={setFilter}
      counts={{ all: rows.length, changed: count, unchanged: rows.length - count }}/>
  </div>
}

function GlobalCards({ slots, selected, onPick, busy }) {
  const cards = useMemo(() => slots.map(slot => {
    const equipped = slot.items.find(item => item.id === selected.get(slot.id))
    const cover = equipped?.image ? equipped : slot.items.find(item => item.image && !item.image.includes('testitem'))
    return { slot, equipped, cover }
  }), [slots, selected])
  const images = useMemo(() => cards.flatMap(({ cover }) => cover ? [cover] : []), [cards])
  const icons = useIcons(images)
  return <div className="global-grid">{cards.map(({ slot, equipped, cover }) => {
    const icon = icons.get(cover?.image)
    const name = globalName(slot.id)
    return <button key={slot.id} type="button" className="global-card" data-rarity={rarityKey(equipped?.rarity)}
      data-equipped={Boolean(equipped)} aria-haspopup="dialog" onClick={() => onPick(slot.id)} disabled={busy}>
      {cover && (icon?.url || !icon) ? <ItemArt item={cover} icon={icon}/> : <Icon name={slotGlyph(slot.id)} className="global-glyph"/>}
      {equipped && <span className="global-mark" title="Alterado"><Icon name="check"/></span>}
      <span className="global-caption"><strong>{name}</strong><small>{slot.supported === false || !slot.items.length
        ? 'Indisponível' : slot.items.length + (slot.items.length === 1 ? ' item' : ' itens')}</small></span>
    </button>
  })}</div>
}

export function Catalog({ catalog, attributeIcons, choices, busy, cli, emptyGlobals, setEmptyGlobals, onHero, onGlobal, onChooseRoot }) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState('all')
  const [heroFilter, setHeroFilter] = useState('all')
  const [globalFilter, setGlobalFilter] = useState('all')
  const changedHeroes = useMemo(() => new Set(choices.filter(choice => choice.hero !== 'global').map(choice => choice.hero)), [choices])
  const selectedGlobals = useMemo(() => new Map(choices.filter(choice => choice.hero === 'global')
    .map(choice => [choice.slot, String(choice.itemId)])), [choices])
  const { heroes, globals } = useMemo(() => {
    const term = fold(query.trim())
    return {
      heroes: catalog?.heroes.filter(hero => fold(hero.name + ' ' + hero.id.replaceAll('_', ' ')).includes(term)) || [],
      globals: catalog?.global.slots.filter(slot => isGlobalVisible(slot, emptyGlobals) &&
        fold(globalName(slot.id) + ' ' + slot.id.replaceAll('_', ' ')).includes(term))
        .sort(compareGlobalSlots) || [],
    }
  }, [catalog, emptyGlobals, query])
  const visibleHeroes = filterRows(heroes, heroFilter, changedHeroes)
  const visibleGlobals = useMemo(() => filterRows(globals, globalFilter, selectedGlobals), [globals, globalFilter, selectedGlobals])
  if (!catalog) return <div className="empty-state panel">
    <Icon name="catalog"/>
    <h2>{busy || 'Selecione a instalação do Dota 2'}</h2>
    {!busy && <button className="primary" onClick={onChooseRoot}>Selecionar pasta</button>}
  </div>
  return <>
    <div className="catalog-toolbar">
      <Search label="Buscar no catálogo" value={query} onChange={setQuery}/>
      <Segments label="Seções do catálogo" className="catalog-segments" options={views}
        value={view} onChange={setView} counts={{ all: heroes.length + globals.length, heroes: heroes.length, globals: globals.length }}/>
    </div>
    {view !== 'globals' && <section className="catalog-section view-entry" aria-label="Heróis">
      <SectionControls title="Heróis" rows={heroes} changed={changedHeroes} filter={heroFilter} setFilter={setHeroFilter}/>
      <div className="hero-groups">{attributes.map(([attribute, label, color]) => {
        const group = visibleHeroes.filter(hero => hero.attribute === attribute)
        if (!group.length && attribute === 'Desconhecido') return null
        return <section className="hero-group" data-attribute={color} key={attribute}>
          <h3><AttributeArt attribute={color} icon={attributeIcons.get(catalog.attributeIcons?.[color])}/>{label}<small>{group.length}</small></h3>
          <div className="portrait-grid">{group.map(hero => {
            const changed = changedHeroes.has(hero.id)
            return <button type="button" key={hero.id} className="hero-card" title={hero.name}
              aria-label={hero.name + (changed ? ', alterado' : '')} onClick={() => onHero(hero.id)} data-changed={changed}>
              <Portrait key={hero.id} hero={hero}/>
              {changed && <span className="hero-mark" aria-hidden="true"/>}
            </button>
          })}</div>
        </section>
      })}</div>
      {!visibleHeroes.length && <p className="empty-message">Nenhum herói corresponde aos filtros.</p>}
    </section>}
    {view !== 'heroes' && <section className="catalog-section view-entry" aria-label="Globais">
      <div className="global-heading">
        <SectionControls title="Globais" rows={globals} changed={selectedGlobals} filter={globalFilter} setFilter={setGlobalFilter}/>
        {catalog.global.slots.some(slot => !isGlobalVisible(slot, false)) && <label className="checkbox-label">
          <input type="checkbox" checked={emptyGlobals} onChange={event => setEmptyGlobals(event.target.checked)}/> Mostrar categorias indisponíveis
        </label>}
      </div>
      <GlobalCards key={cli} slots={visibleGlobals} selected={selectedGlobals} onPick={onGlobal} busy={Boolean(busy)}/>
      {!visibleGlobals.length && <p className="empty-message">Nenhuma categoria corresponde aos filtros.</p>}
    </section>}
  </>
}
