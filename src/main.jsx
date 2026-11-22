import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import { Catalog } from './Catalog.jsx'
import { Hero } from './Hero.jsx'
import { ItemPicker } from './ItemPicker.jsx'
import { Presets } from './Presets.jsx'
import { Settings } from './Settings.jsx'
import { compareGlobalSlots, compareHeroSlots, Icon } from './ui.jsx'

const api = window.arsenal
const pages = {
  catalog: ['Catálogo', 'catalog'],
  presets: ['Presets / Packs', 'pack'],
  settings: ['Configurações', 'settings'],
}

function App() {
  const [root, setRoot] = useState('')
  const [catalog, setCatalog] = useState(null)
  const [heroId, setHero] = useState('')
  const [tab, setTab] = useState('catalog')
  const [collapsed, setCollapsed] = useState(false)
  const [choices, setChoices] = useState([])
  const [presets, setPresets] = useState([])
  const [presetName, setPresetName] = useState('')
  const [store, setStore] = useState('')
  const [cacheStatus, setCacheStatus] = useState({ phase: 'ocioso' })
  const [cli, setCli] = useState('')
  const [log, setLog] = useState('')
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [emptyHeroSlots, setEmptyHeroSlots] = useState(false)
  const [emptyGlobals, setEmptyGlobals] = useState(false)
  const [activeSlot, setActiveSlot] = useState(null)
  const content = useRef(null)
  const catalogScroll = useRef(0)
  const hero = catalog?.heroes.find(owner => owner.id === heroId)
  const owner = hero || catalog?.global
  const owners = useMemo(() => catalog ? [...catalog.heroes, catalog.global] : [], [catalog])
  const selected = useMemo(() => new Map(choices.filter(choice => choice.hero === owner?.id)
    .map(choice => [choice.slot, choice])), [choices, owner])
  const reveal = hero ? emptyHeroSlots : emptyGlobals
  const compareSlots = hero ? compareHeroSlots : compareGlobalSlots
  const pickerSlots = useMemo(() => owner?.slots.filter(slot => reveal || (slot.supported !== false && slot.items.length)).sort(compareSlots) || [],
    [owner, reveal, compareSlots])
  const pickerSlot = pickerSlots.find(slot => slot.id === activeSlot)
  const canApply = Boolean(!busy && catalog && choices.length)
  const gamePath = root ? root.replace(/[\\/]+$/, '') + '\\game' : ''

  useLayoutEffect(() => {
    content.current.scrollTop = tab === 'catalog' && !heroId ? catalogScroll.current : 0
  }, [tab, heroId])
  useEffect(() => api?.onIconProgress(setCacheStatus), [])

  async function job(label, fn) {
    setBusy(label); setMessage(''); setError(false)
    try { await fn() } catch (e) {
      setError(true); setMessage(e.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''))
    } finally { setBusy('') }
  }
  async function scan() {
    catalogScroll.current = 0
    setCatalog(null); setHero(''); setActiveSlot(null)
    setCatalog(await api.scan())
  }
  useEffect(() => {
    job('Lendo instalação…', async () => {
      if (!api) throw Error('Abra a interface pelo aplicativo Electron.')
      const data = await api.init()
      setPresets(data.presets); setStore(data.store); setRoot(data.root || ''); setCli(data.cli); setLog(data.log)
      if (data.root) await scan()
    })
  }, [])

  function chooseRoot() {
    job('Lendo instalação…', async () => {
      const dir = await api.choose()
      if (dir) { setRoot(dir); setReport(null); await scan() }
    })
  }
  function openHero(id) {
    catalogScroll.current = content.current.scrollTop
    setEmptyHeroSlots(false)
    setHero(id)
  }
  function changeTab(name) {
    if (tab === 'catalog' && !heroId && name !== tab) catalogScroll.current = content.current.scrollTop
    setTab(name); setHero(''); setActiveSlot(null)
  }
  function chooseItem(slotId, itemId, styleId) {
    setChoices(current => {
      const previous = current.find(choice => choice.hero === owner.id && choice.slot === slotId)
      if ((!previous && !itemId) || (previous && String(previous.itemId) === itemId && styleId === undefined)) return current
      const remaining = current.filter(choice => choice.hero !== owner.id || choice.slot !== slotId)
      if (itemId) remaining.push({ hero: owner.id, slot: slotId, itemId, styleId: styleId ?? null })
      return remaining
    })
    setMessage(''); setError(false)
  }
  function clearHero() {
    setChoices(current => current.filter(choice => choice.hero !== hero.id))
    setMessage('Seleções de ' + hero.name + ' limpas.'); setError(false)
  }
  function applyMods(force = false) {
    job('Gerando VPK…', async () => {
      const result = await api.apply(choices, force)
      setReport(result); changeTab('settings'); setError(!result.ok)
      setMessage(result.ok ? 'Mods gravados e verificados em disco.' : 'Falha na aplicação ou na verificação. Consulte o diagnóstico.')
    })
  }
  function loadPack(pack) {
    setChoices(pack.selections); setPresetName(pack.name); setError(false)
    setMessage('Pack carregado na seleção atual.')
  }

  return <div className="shell" data-collapsed={collapsed}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><Icon name="brand"/></span>
        <span className="brand-text"><strong>Dota 2</strong><small>Local Skin Changer</small></span>
      </div>
      <nav aria-label="Navegação principal">
        {Object.entries(pages).map(([id, [name, icon]]) => <button key={id} type="button" onClick={() => changeTab(id)}
          aria-label={name} aria-current={tab === id ? 'page' : undefined} title={name}>
          <Icon name={icon}/><span>{name}</span>
        </button>)}
      </nav>
      <button type="button" className="collapse-button" aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'} onClick={() => setCollapsed(value => !value)}>
        <Icon name="collapse"/><span>{collapsed ? 'Expandir menu' : 'Recolher menu'}</span>
      </button>
    </aside>

    <header className="topbar">
      <h1>{pages[tab][0]}</h1>
      <div className="header-actions">
        <button type="button" disabled={!canApply} onClick={() => applyMods()}><Icon name="download"/> Aplicar mods</button>
        <button type="button" className="play" disabled={!!busy || !api} onClick={() => job('Abrindo Steam…', async () => {
          await api.play(); setMessage('Solicitação enviada à Steam.')
        })}><span aria-hidden="true">▶</span> Jogar</button>
      </div>
    </header>

    <main className="workspace" ref={content}>
      <div hidden={tab !== 'catalog' || Boolean(hero)}>
        <Catalog catalog={catalog} choices={choices} busy={busy} cli={cli} emptyGlobals={emptyGlobals} setEmptyGlobals={setEmptyGlobals}
          onHero={openHero} onGlobal={setActiveSlot} onChooseRoot={chooseRoot}/>
      </div>
      {tab === 'catalog' && hero && <Hero hero={hero} visibleSlots={pickerSlots} selected={selected} busy={Boolean(busy)} showEmpty={emptyHeroSlots}
        onShowEmpty={setEmptyHeroSlots} onSlot={setActiveSlot} onStyle={chooseItem} onClear={clearHero} onBack={() => setHero('')}/>}
      {tab === 'catalog' && pickerSlot && <ItemPicker key={owner.id} owner={owner} slots={pickerSlots} slot={pickerSlot} selected={selected}
        busy={Boolean(busy)} onSlot={setActiveSlot} onChange={itemId => chooseItem(pickerSlot.id, itemId)} onClose={() => setActiveSlot(null)}/>}
      {tab === 'presets' && <Presets owners={owners} choices={choices} presets={presets} presetName={presetName}
        setPresetName={setPresetName} store={store} busy={Boolean(busy)} onLoad={loadPack}
        onRemove={choice => setChoices(current => current.filter(entry => entry !== choice))}
        onSave={() => job('Salvando…', async () => {
          setPresets(await api.savePreset(presetName, choices)); setMessage('Pack salvo.')
        })}
        onExport={pack => job('Exportando…', async () => {
          if (await api.exportPack(pack.name, pack.selections)) setMessage('Pack exportado.')
        })}
        onImport={() => job('Importando…', async () => {
          const result = await api.importPack()
          if (result) { setPresets(result.presets); loadPack(result.preset) }
        })}/>}
      {tab === 'settings' && <Settings gamePath={gamePath} root={root} cli={cli} store={store} log={log} report={report}
        busy={Boolean(busy)} canApply={canApply} onChooseRoot={chooseRoot} onScan={() => job('Atualizando catálogo…', scan)}
        cacheStatus={cacheStatus} onIndexIcons={() => api.indexIcons()}
        onChooseCli={() => job('Selecionando CLI…', async () => setCli(await api.chooseCli()))}
        onDiagnose={() => job('Verificando arquivos…', async () => setReport(await api.diagnose()))}
        onForceApply={() => applyMods(true)}
        onRestore={() => job('Restaurando…', async () => {
          await api.restore(); setReport(null); setMessage('Jogo restaurado. Presets preservados.')
        })}
        onRecover={() => job('Recuperando…', async () => {
          const result = await api.recover()
          if (result) { setReport(null); setMessage('Backup restaurado e mods limpos.' + (result.preserved ? ' VPK anterior em ' + result.preserved : '')) }
        })}/>}
    </main>

    <footer className="statusbar">
      <span className="game-location" title={gamePath}>
        <i className={catalog ? 'on' : ''} aria-hidden="true"/>
        {gamePath ? 'Dota 2 · ' + gamePath : 'Pasta do Dota 2 não selecionada'}
      </span>
      <div role="status" className={error ? 'error' : ''}>{busy || message || choices.length + (choices.length === 1 ? ' slot selecionado' : ' slots selecionados')}</div>
    </footer>
  </div>
}
createRoot(document.getElementById('root')).render(<App/>)
