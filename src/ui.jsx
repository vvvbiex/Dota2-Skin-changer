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
  armor: 'M5 5l4-2 3 3 3-3 4 2-2 7 1 6-6 3-6-3 1-6z M8 12h8 M12 6v6',
  arms: 'M7 4h10l2 5-3 10-4 2-4-2L5 9z M6 9h12 M8 15h8',
  backpiece: 'M8 4h8l1 4 3 12-5-2-3 2-3-2-5 2L7 8z M8 4l4 4 4-4',
  boots: 'M8 3h9v9l4 4v4H4v-4l4-3z M4 17h17 M8 8h5',
  belt: 'M3 8h18v8H3z M9 8v8 M15 8v8 M12 10v4',
  shoulder: 'M3 15l4-8 5-3 5 3 4 8-5 3-4-4-4 4z',
  mount: 'M5 21h15l-2-8-4-6-3-4v5l-7 5 2 5 6-3 1 3-8 3z M11 11h.01',
  aura: 'M12 2v4 M12 18v4 M2 12h4 M18 12h4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  mask: 'M3 5l9 2 9-2-2 11-7 5-7-5z M7 11l3 1 M17 11l-3 1',
  creature: 'M9 11a2 3 0 1 1-4 0 2 3 0 0 1 4 0z M19 11a2 3 0 1 1-4 0 2 3 0 0 1 4 0z M14 6a2 3 0 1 1-4 0 2 3 0 0 1 4 0z M6 18c0-2 4-4 6-4s6 2 6 4-3 3-6 1c-3 2-6 1-6-1z',
  tail: 'M4 19c9 1 8-10 16-10 M16 5l5 4-5 4',
  sound: 'M9 5v12 M9 6l10-3v11 M9 17c0 4-7 4-7 1s7-4 7-1z M19 14c0 4-7 4-7 1s7-4 7-1z',
  microphone: 'M9 6a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0z M5 11v1a7 7 0 0 0 14 0v-1 M12 19v3 M9 22h6',
  cursor: 'M5 3l14 10-7 1-3 6z',
  tower: 'M5 3v6l3 3-2 9h12l-2-9 3-3V3h-4v3H9V3z M8 12h8',
  siege: 'M3 17h18 M6 17l3-7 9-4 M15 5l3 1 1 3 M9 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M19 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  flag: 'M5 21V4 M5 5h14l-3 4 3 4H5',
  screen: 'M3 4h18v14H3z M3 14l5-4 4 3 3-2 6 4 M9 21h6',
  medal: 'M7 3h10l-2 6H9z M17 15a5 5 0 1 1-10 0 5 5 0 0 1 10 0z M12 13v4 M10 15h4',
  bolt: 'M13 2L5 14h6l-1 8 9-12h-6z',
  portal: 'M18 12a6 9 0 1 1-12 0 6 9 0 0 1 12 0z M15 12a3 6 0 1 1-6 0 3 6 0 0 1 6 0z',
  statue: 'M8 21h8v-4l-2-3v-3l2-2-1-5H9L8 9l2 2v3l-2 3z M5 21h14',
  skull: 'M6 16l-2-3V9a8 8 0 0 1 16 0v4l-2 3-2 1v4H8v-4z M8 11h2 M14 11h2 M12 18v3',
  map: 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16',
  crystal: 'M12 2l7 7-3 10-4 3-4-3L5 9z M12 2v20 M5 9h14',
  necklace: 'M5 4c0 6 2 9 7 12 5-3 7-6 7-12 M12 14l3 4-3 4-3-4z',
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
    <path d={glyphs[name] || glyphs.diamond}/>
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
  legs: 'Pernas', gloves: 'Luvas', neck: 'Pescoço', body_head: 'Corpo e cabeça', costume: 'Traje',
  misc: 'Acessórios', shapeshift: 'Transformação', voice: 'Voz', hero_effigy: 'Estátua do herói',
  ambient_effects: 'Aura', ability_ultimate: 'Habilidade suprema',
}
function slotFamily(id) {
  const [, base, persona] = /^(.*?)(?:_persona_(\d+))?$/.exec(id)
  return [base, persona]
}
export function slotName(id) {
  const [base, persona] = slotFamily(id)
  const ability = /^(ability_effects_|ability)(\d+)$/.exec(base)
  const name = slotNames[base] || globalNames[base] || (ability
    ? (ability[1] === 'ability' ? 'Habilidade ' : 'Efeitos da habilidade ') + ability[2] : 'Outro equipamento')
  return persona ? `${name} · Persona ${persona}` : name
}
export const globalName = id => globalNames[id] || 'Outra categoria'
export const isGlobalVisible = (slot, showUnavailable) => showUnavailable || (slot.supported !== false && slot.items.length > 0)
const featuredGlobals = ['terrain', 'courier', 'ward', 'weather', 'hud_skin', 'loading_screen']
function globalRank(id) {
  const rank = featuredGlobals.indexOf(id)
  return rank < 0 ? featuredGlobals.length : rank
}
export const compareGlobalSlots = (a, b) => globalRank(a.id) - globalRank(b.id)
const heroSlotRank = id => id === 'hero_base' ? -2 : id === 'persona_selector' ? -1 : 0
export const compareHeroSlots = (a, b) => heroSlotRank(a.id) - heroSlotRank(b.id)
export const fold = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
const equipmentGlyphs = {
  hero_base: 'mask', body_head: 'mask', persona_selector: 'mask', offhand_weapon: 'weapon',
  back: 'backpiece', legs: 'boots', gloves: 'arms', costume: 'armor', neck: 'necklace', misc: 'pack',
  summon: 'creature', shapeshift: 'mask', ambient_effects: 'aura', hero_effigy: 'statue', voice: 'microphone',
  loading_screen: 'screen', versus_screen: 'screen', hud_skin: 'catalog', music: 'sound', announcer: 'microphone',
  cursor_pack: 'cursor', emblem: 'medal', multikill_banner: 'flag', mega_kills: 'skull', kill_effect: 'skull',
  death_effect: 'skull', streak_effect: 'bolt', teleport_effect: 'portal', blink_effect: 'bolt', heroic_statue: 'statue',
  head_effect: 'aura', courier_effect: 'aura', map_effect: 'map', ancient: 'crystal', tormentor: 'crystal',
  roshan: 'creature', pet_effigy: 'creature', radiant_creeps: 'creature', dire_creeps: 'creature',
  radiant_towers: 'tower', dire_towers: 'tower', radiant_siege_creeps: 'siege', dire_siege_creeps: 'siege',
}
export function slotGlyph(id) {
  const [base] = slotFamily(id)
  return equipmentGlyphs[base] || (base.startsWith('ability') ? 'aura' : base)
}

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
