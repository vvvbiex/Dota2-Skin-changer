import path from 'node:path'
import { openVpk, ITEMS_PATH } from './vpk.js'
import { parseKV, children, find, scalar } from './kv1.js'

const heroPrefix = 'npc_dota_hero_'
const attributes = new Map(Object.entries({
  DOTA_ATTRIBUTE_STRENGTH: 'Força', DOTA_ATTRIBUTE_AGILITY: 'Agilidade',
  DOTA_ATTRIBUTE_INTELLECT: 'Inteligência', DOTA_ATTRIBUTE_ALL: 'Universal',
}))
export const attributeIcons = Object.fromEntries(['strength', 'agility', 'intelligence', 'universal'].map(key =>
  [key, 'primary_attribute_icons/primary_attribute_icon_' + (key === 'universal' ? 'all' : key) + '_psd']))
const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR')
const label = id => id.replace(heroPrefix, '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())

// KV1 #base/prefab inheritance fills absent keys, including keys in nested blocks.
function inherit(own, base) {
  if (!base.length) return own
  const result = [...own]
  const ownKeys = new Map(own.map(node => [node.key, node]))
  for (const node of base) {
    const local = ownKeys.get(node.key)
    if (!local) result.push(node)
    else if (Array.isArray(local.value) && Array.isArray(node.value) &&
      own.filter(n => n.key === node.key).length === 1 && base.filter(n => n.key === node.key).length === 1) {
      result[result.indexOf(local)] = { key: local.key, value: inherit(local.value, node.value), condition: local.condition }
    }
  }
  return result
}

export function parseItemsGame(text, { heroDefinitions = [], tokens = new Map() } = {}) {
  const document = parseKV(text)
  const root = children(find(document, 'items_game'))
  const items = children(find(root, 'items'))
  if (!items.length) throw Error('O esquema não contém items_game/items.')
  if ([document, root, items].some(nodes => nodes.some(n => n.key.startsWith('#')))) {
    throw Error('O esquema de itens referencia arquivos externos.')
  }
  const prefabs = new Map(children(find(root, 'prefabs')).map(n => [n.key, children(n)]))
  const cache = new Map()
  function effective(nodes, visiting = []) {
    let result = nodes
    for (const name of (scalar(nodes, 'prefab') || '').split(/\s+/).filter(Boolean)) {
      if (visiting.includes(name)) throw Error('Ciclo de prefab: ' + name)
      if (!prefabs.has(name)) throw Error('Prefab ausente: ' + name)
      if (!cache.has(name)) cache.set(name, effective(prefabs.get(name), [...visiting, name]))
      result = inherit(result, cache.get(name))
    }
    return result
  }
  const translate = (key, fallback) => tokens.get(key?.replace(/^#/, '').toLowerCase()) || fallback
  const heroes = new Map()
  const global = { id: 'global', name: 'Itens globais', slots: new Map() }
  const records = new Map()
  function hero(id) {
    if (!heroes.has(id)) heroes.set(id, { id, name: translate(id, label(id)), attribute: 'Desconhecido', sets: [], slots: new Map() })
    return heroes.get(id)
  }
  function slot(owner, id) {
    if (!owner.slots.has(id)) owner.slots.set(id, { id, defaultIds: [], items: [] })
    return owner.slots.get(id)
  }
  for (const definition of heroDefinitions) {
    if (!definition.key.startsWith(heroPrefix) || ['npc_dota_hero_base', 'npc_dota_hero_target_dummy'].includes(definition.key)) continue
    const h = hero(definition.key)
    h.attribute = attributes.get(scalar(children(definition), 'AttributePrimary')) || h.attribute
    for (const node of children(find(children(definition), 'ItemSlots'))) {
      const id = scalar(children(node), 'SlotName')
      if (id) slot(h, id)
    }
  }
  const globals = new Set(['terrain', 'weather', 'courier', 'ward', 'loading_screen', 'cursor_pack', 'announcer',
    'mega_kills', ...children(find(root, 'player_loadout_slots')).map(n => n.value)])
  const bundles = []
  const byInternalName = new Map()
  function prefabTypes(nodes, types = new Set()) {
    for (const type of (scalar(nodes, 'prefab') || '').split(/\s+/).filter(Boolean)) {
      if (types.has(type)) continue
      types.add(type)
      prefabTypes(prefabs.get(type) || [], types)
    }
    return types
  }
  for (const node of items) {
    if (!/^\d+$/.test(node.key)) continue
    if (records.has(node.key)) throw Error('ID de item duplicado: ' + node.key)
    const fields = effective(children(node))
    const id = node.key
    const used = children(find(fields, 'used_by_heroes')).filter(n => n.value === '1').map(n => n.key)
    const heroIds = used.filter(id => id.startsWith(heroPrefix))
    for (const id of heroIds) if (id !== 'npc_dota_hero_base' && id !== 'npc_dota_hero_target_dummy') hero(id)
    const types = prefabTypes(children(node))
    const rawSlot = scalar(fields, 'item_slot')
    const prefabSlots = [...types].map(type => scalar(cache.get(type) || [], 'item_slot') || type)
    const category = prefabSlots.find(type => globals.has(type)) || [...types].find(type => globals.has(type))
    const isDefault = scalar(fields, 'baseitem') === '1' || types.has('default_item')
    const slotId = globals.has(rawSlot) ? rawSlot : category || rawSlot
    const isGlobal = globals.has(slotId) && (!used.length || Boolean(category))
    const isBundle = types.has('bundle') || !!find(fields, 'bundle') || scalar(fields, 'item_class') === 'bundle'
    const typeName = scalar(fields, 'item_type_name') || ''
    const voice = /(?:^|_)Voice(?:_Pack)?$/i.test(typeName) || types.has('voice_pack')
    const equipment = !/_(?:Loading_Screen|Cursor_Pack|Announcer|Bundle)$/i.test(typeName) &&
      (!voice || /^voice(?:_persona_\d+)?$/.test(slotId)) &&
      (!types.size || ['wearable', 'default_item', 'taunt'].some(type => types.has(type)))
    const visuals = children(find(fields, 'visuals'))
    const styles = children(find(visuals, 'styles') || find(fields, 'styles')).filter(n => /^\d+$/.test(n.key)).map(n => {
      const name = scalar(children(n), 'name')
      return { id: n.key, name: translate(name, name && !name.startsWith('#') ? name : 'Estilo ' + (Number(n.key) + 1)) }
    })
    const item = {
      id, name: translate(scalar(fields, 'item_name'), scalar(fields, 'name') || id),
      rarity: scalar(fields, 'item_rarity') || 'common', image: scalar(fields, 'image_inventory') || null, styles,
    }
    const record = { node, fields, used, heroIds, slotId, isGlobal, isDefault, item, equipment: equipment && !category, isBundle }
    records.set(id, record)
    byInternalName.set(scalar(fields, 'name')?.toLowerCase(), record)
    if (isBundle) bundles.push(record)
  }
  const declared = new Map([...heroes].filter(([, h]) => h.slots.size).map(([id, h]) => [id, new Set(h.slots.keys())]))
  for (const record of records.values()) {
    const { slotId, isGlobal, used, heroIds, item, isDefault } = record
    if (!slotId || slotId === 'none' || record.isBundle || (!isGlobal && (!record.equipment || globals.has(slotId)))) continue
    const owners = isGlobal ? [global] : used.includes('all') ? heroes.values() : heroIds.map(id => heroes.get(id)).filter(Boolean)
    for (const owner of owners) {
      if (declared.has(owner.id) && !declared.get(owner.id).has(slotId)) continue
      const group = slot(owner, slotId)
      if (isDefault) group.defaultIds.push(item.id)
      else group.items.push(item)
    }
  }
  function finish(owner) {
    const slots = [...owner.slots.values()]
    for (const group of slots) {
      group.items.sort(byName)
      if (owner === global) {
        const native = group.defaultIds.filter(id => scalar(records.get(id).fields, 'item_slot') === group.id)
        if (native.length) group.defaultIds = native
      }
      const defaults = group.defaultIds.map(id => records.get(id))
      const specific = defaults.filter(r => r.isGlobal || (r.used.length === 1 && r.used[0] === owner.id))
      const taunt = /^taunt(?:_persona_\d+)?$/.test(group.id) && owner !== global
      group.defaultId = specific.length === 1 && (defaults.length === 1 || taunt) ? specific[0].item.id : null
      group.defaultIconPath = (group.defaultId ? records.get(group.defaultId) : defaults.length === 1 && defaults[0])?.item?.image || null
      if (owner === global) group.supported = Boolean(group.defaultId)
      group.scopedTaunt = taunt && !specific.length
      group.scopedDefault = group.scopedTaunt || (owner !== global && group.id === 'summon' &&
        defaults.length === 1 && !specific.length && defaults[0].heroIds.includes(owner.id))
      if (!group.defaultId && !group.scopedDefault) group.reason = !defaults.length ? 'Sem item padrão no esquema.' :
        defaults.length > 1 ? 'Mais de um item padrão neste slot.' : 'Item padrão compartilhado entre heróis.'
    }
    return { ...owner, slots }
  }
  const catalogHeroes = [...heroes.values()].map(finish).sort(byName)
  const equipmentByItem = new Map()
  for (const h of catalogHeroes) for (const group of h.slots) for (const item of group.items) {
    if (!equipmentByItem.has(item.id)) equipmentByItem.set(item.id, [])
    equipmentByItem.get(item.id).push({ h, group })
  }
  for (const bundle of bundles) {
    const members = new Map()
    for (const node of children(find(bundle.fields, 'bundle'))) {
      const part = records.get(node.key) || byInternalName.get(node.key.toLowerCase())
      for (const { h, group } of equipmentByItem.get(part?.item.id) || []) {
        if (bundle.heroIds.length && !bundle.heroIds.includes(h.id)) continue
        if (!members.has(h)) members.set(h, [])
        members.get(h).push({ slot: group.id, itemId: part.item.id })
      }
    }
    // Without an explicit owner, only infer sets with a single hero.
    if (!bundle.heroIds.length && members.size !== 1) continue
    const { id, name, rarity, image } = bundle.item
    for (const [h, items] of members) h.sets.push({ id, name, rarity, iconPath: image, items })
  }
  for (const h of catalogHeroes) h.sets.sort(byName)
  return { text, records, catalog: { heroes: catalogHeroes, global: finish(global), attributeIcons } }
}

export function loadGame(root) {
  const heroFile = /^scripts\/npc\/heroes\/npc_dota_hero_[\w]+\.txt$/
  const npc = 'scripts/npc/npc_heroes.txt'
  const localization = /^resource\/localization\/(?:dota|items)_(?:english|brazilian)\.txt$/
  const pack = openVpk(path.join(root, 'game', 'dota', 'pak01_dir.vpk'),
    p => p === ITEMS_PATH || p === npc || heroFile.test(p) || localization.test(p))
  const read = p => pack.read(p).toString('utf8')
  const heroDefinitions = []
  if (pack.has(npc)) {
    const defs = parseKV(read(npc))
    for (const ref of defs.filter(n => n.key.toLowerCase() === '#base')) {
      const entry = path.posix.normalize(path.posix.join('scripts/npc', ref.value.replaceAll('\\', '/')))
      if (heroFile.test(entry) && pack.has(entry)) heroDefinitions.push(...children(find(parseKV(read(entry)), 'DOTAHeroes')))
    }
    heroDefinitions.push(...children(find(defs, 'DOTAHeroes')))
  }
  const tokens = new Map()
  for (const lang of ['english', 'brazilian']) {
    for (const group of ['items', 'dota']) {
      const p = 'resource/localization/' + group + '_' + lang + '.txt'
      if (!pack.has(p)) continue
      for (const node of children(find(children(parseKV(read(p))[0]), 'Tokens'))) {
        if (typeof node.value === 'string') tokens.set(node.key.toLowerCase(), node.value)
      }
    }
  }
  return parseItemsGame(read(ITEMS_PATH), { heroDefinitions, tokens })
}
