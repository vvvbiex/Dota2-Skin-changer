import React from 'react'

const glyphs = {
  brand: 'M4 3h15l2 2v14l-2 2H4l-1-1V4z M8 6l10 12 M14 6h4v4 M6 14v4h4',
  catalog: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  pack: 'M4 7l8-4 8 4v10l-8 4-8-4z M4 7l8 4 8-4 M12 11v10 M8 5l8 4',
  settings: 'M10 3h4l1 3 3 1 3 1v4l-2 2v4l-4 2-3-1-3 1-4-2v-4l-2-2V8l3-1 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  collapse: 'M11 6l-6 6 6 6 M18 6l-6 6 6 6',
  back: 'M19 12H5 M12 5l-7 7 7 7',
  forward: 'M5 12h14 M12 5l7 7-7 7',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0z M15 15l5 5',
  download: 'M12 3v12 M8 11l4 4 4-4 M4 17v4h16v-4',
  close: 'M6 6l12 12 M18 6L6 18',
  reset: 'M4 11a8 8 0 1 1 2 6 M4 5v6h6',
  check: 'M5 12l4 4L19 6',
  plus: 'M5 12h14 M12 5v14',
  diamond: 'M12 3l9 9-9 9-9-9z',
  strength: 'M4 16l7-7 4 4-7 7z M10 8l4-4 6 6-4 4z',
  agility: 'M4 17L20 4 13 20l-2-7z M4 20l3-3',
  intelligence: 'M12 2l3 6 6 4-6 4-3 6-3-6-6-4 6-4z',
  universal: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 3v18 M3 12h18',
  equipment: 'M8 3L3 7l2 5 3-1v10h8V11l3 1 2-5-5-4-4 3z',
  weapon: 'M20 3l-2 8-7 7-5-5 7-7z M4 12l8 8 M7 17l-4 4',
  head: 'M4 14V9l4-5h8l4 5v5l-4 5h-3v-5h-2v5H8z M4 11h16',
  taunt: 'M4 12l12-6v12L4 14z M7 15l2 5h3 M19 9l2-2 M19 15l2 2',
  terrain: 'M2 19l7-12 4 6 3-4 6 10z M9 7l2 3-3 1',
  courier: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',
  ward: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  weather: 'M6 16a4 4 0 1 1 1-8 5 5 0 0 1 10-1 4.5 4.5 0 1 1 1 9z',
}

export function Icon({ name, className }) {
  return <svg className={className} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={glyphs[name] || glyphs.equipment}/>
  </svg>
}

export const attributes = [
  ['Força', 'Força', 'strength'], ['Agilidade', 'Agilidade', 'agility'],
  ['Inteligência', 'Inteligência', 'intelligence'], ['Universal', 'Universais', 'universal'],
  ['Desconhecido', 'Sem atributo', 'unknown'],
]

const globalNames = {
  terrain: 'Terrenos', courier: 'Entregadores', ward: 'Sentinelas', weather: 'Clima', mega_kills: 'Mega-abates',
  hud_skin: 'Interfaces', music: 'Trilhas musicais', loading_screen: 'Telas de carregamento', emblem: 'Emblemas',
  radiant_creeps: 'Criaturas da Luz', dire_creeps: 'Criaturas das Trevas', radiant_towers: 'Torres da Luz',
  dire_towers: 'Torres das Trevas', kill_effect: 'Efeitos de abate', announcer: 'Locutores', cursor_pack: 'Cursores',
  multikill_banner: 'Faixas de multiabate', teleport_effect: 'Efeitos de teletransporte', heroic_statue: 'Estátuas',
  blink_effect: 'Efeitos de adaga', radiant_siege_creeps: 'Catapultas da Luz', dire_siege_creeps: 'Catapultas das Trevas',
  versus_screen: 'Telas de confronto', streak_effect: 'Efeitos de sequência', head_effect: 'Efeitos de cabeça',
  courier_effect: 'Efeitos de entregador', death_effect: 'Efeitos de morte', map_effect: 'Efeitos de mapa',
  ancient: 'Ancestrais', roshan: 'Roshan', tormentor: 'Atormentadores', pet_effigy: 'Mascotes',
}
const slotNames = {
  hero_base: 'Forma base', persona_selector: 'Persona', head: 'Cabeça', arms: 'Braços',
  weapon: 'Arma', offhand_weapon: 'Arma secundária', armor: 'Armadura', back: 'Costas', belt: 'Cinto',
  shoulder: 'Ombros', mount: 'Montaria', taunt: 'Provocação', tail: 'Cauda', summon: 'Invocação',
  terrain: 'Terreno', courier: 'Entregador', ward: 'Sentinela',
}
export const slotName = id => slotNames[id] || globalNames[id] || id.replaceAll('_', ' ')
export const globalName = id => globalNames[id] || slotName(id)
const featuredGlobals = ['terrain', 'courier', 'ward', 'weather', 'hud_skin', 'loading_screen']
function globalRank(id) {
  const rank = featuredGlobals.indexOf(id)
  return rank < 0 ? featuredGlobals.length : rank
}
export const compareGlobalSlots = (a, b) => globalRank(a.id) - globalRank(b.id)
const heroSlotRank = id => id === 'hero_base' ? -2 : id === 'persona_selector' ? -1 : 0
export const compareHeroSlots = (a, b) => heroSlotRank(a.id) - heroSlotRank(b.id)
export const fold = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
export const slotGlyph = id => ({ hero_base: 'diamond', offhand_weapon: 'weapon', persona_selector: 'diamond',
  summon: 'diamond', loading_screen: 'terrain', hud_skin: 'catalog' })[id] || id

export function Portrait({ hero, eager = false }) {
  const id = hero.id.replace(/^npc_dota_hero_/, '')
  const src = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/' + encodeURIComponent(id) + '.png'
  return <span className="portrait" aria-hidden="true"><b>{hero.name.slice(0, 2).toUpperCase()}</b>
    <img src={src} loading={eager ? 'eager' : 'lazy'} decoding="async" alt="" onError={e => { e.currentTarget.hidden = true }}/>
  </span>
}

export function Search({ label, value, onChange, autoFocus = false }) {
  return <div className="search-field">
    <Icon name="search"/>
    <input type="search" aria-label={label} placeholder={label + '…'} value={value} autoFocus={autoFocus}
      onChange={event => onChange(event.target.value)}/>
  </div>
}
