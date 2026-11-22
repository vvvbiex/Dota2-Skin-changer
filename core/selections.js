/** Apply a bundle to a selection in one transaction. Keys in styles are donor item IDs. */
export function equipSet(choices, hero, setId, styles = {}) {
  const set = hero?.sets.find(entry => entry.id === String(setId))
  if (!set) throw Error('Conjunto ausente no catálogo deste herói.')
  const replacements = new Map()
  for (const { slot, itemId } of set.items) {
    // Some bundles contain alternatives for the same slot. Prefer the first listed piece.
    if (replacements.has(slot)) continue
    const group = hero.slots.find(group => group.id === slot)
    const item = group?.items.find(item => item.id === itemId)
    if (!item || (!group.defaultId && !group.scopedDefault)) throw Error('Slot indisponível no conjunto: ' + slot)
    const styleId = styles[itemId] == null ? null : String(styles[itemId])
    if (styleId !== null && !item.styles.some(style => style.id === styleId)) throw Error('Estilo inválido para ' + item.name)
    replacements.set(slot, { hero: hero.id, slot, itemId, styleId })
  }
  return [...choices.filter(choice => choice.hero !== hero.id || !replacements.has(choice.slot)), ...replacements.values()]
}
