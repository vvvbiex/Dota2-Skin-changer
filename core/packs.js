const format = 'dota-local-skins-pack'
const version = 1
const key = /^[a-z0-9_]{1,100}$/i
const id = /^\d{1,16}$/
const validId = value => (typeof value === 'string' || Number.isSafeInteger(value)) && id.test(value)

export function createPack(name, selections) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 ||
      !Array.isArray(selections) || selections.length > 8192) throw Error('Nome ou lista de seleções do pack inválido.')
  const slots = new Set()
  const normalized = selections.map(selection => {
    const { hero, slot, itemId, styleId } = selection ?? {}
    if (typeof hero !== 'string' || !key.test(hero) || (hero !== 'global' && !hero.startsWith('npc_dota_hero_')) ||
        typeof slot !== 'string' || !key.test(slot) || !validId(itemId) || (styleId != null && !validId(styleId))) {
      throw Error('O pack contém uma seleção inválida.')
    }
    const address = hero + '/' + slot
    if (slots.has(address)) throw Error('O pack contém um slot duplicado: ' + address)
    slots.add(address)
    return { hero, slot, itemId: String(itemId), styleId: styleId == null ? null : String(styleId) }
  })
  return { format, version, name: name.trim(), selections: normalized }
}

export function readPack(text) {
  let data
  try { data = JSON.parse(text.replace(/^\uFEFF/, '')) }
  catch { throw Error('O arquivo do pack precisa conter JSON válido.') }
  if (data?.format !== format || data.version !== version) throw Error('Formato ou versão de pack incompatível.')
  return createPack(data.name, data.selections)
}
