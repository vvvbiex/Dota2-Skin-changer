import { children, find, scalar, spliceText } from './kv1.js'

const appearance = new Set([
  'visuals', 'portraits', 'used_by_heroes', 'model_player', 'model_player1', 'model_player2',
  'model_player3', 'model_world', 'image_inventory', 'image_inventory_overlay', 'particle_folder',
  'particle_snapshot', 'match_cycle_to_parent', 'override_attack_attachments', 'set_parent_skin',
  'disable_hero_portrait_override', 'skin', 'body_groups', 'material_override', 'styles',
])
const visualAttributes = new Set(['model skin', 'custom particle system', 'custom particle system model',
  'set item tint RGB', 'set item tint RGB 2', 'attach particle effect', 'particle effect use head origin'])
const quote = value => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"'

function render(node, text, newline, depth) {
  if (node.start !== undefined) return text.slice(node.start, node.end)
  const key = quote(node.key)
  const condition = node.condition ? ' ' + node.condition : ''
  if (!Array.isArray(node.value)) return key + '\t\t' + quote(node.value) + condition
  const indent = '\t'.repeat(depth)
  return key + newline + indent + '{' + newline +
    node.value.map(n => indent + '\t' + render(n, text, newline, depth + 1) + newline).join('') +
    indent + '}' + condition
}

function styledVisuals(visuals, styleId) {
  const output = []
  for (const field of children(visuals)) {
    if (field.key === 'styles') {
      const style = find(children(field), styleId)
      if (!style) throw Error('Estilo ausente na definição visual.')
      const settings = children(style).filter(n => !['unlock', 'auto_style_rule', 'auto_style_reason'].includes(n.key))
      output.push({ key: 'styles', value: [{ key: '0', value: settings }] })
      continue
    }
    const gate = /^asset_modifier\d*$/.test(field.key) ? scalar(children(field), 'style') : undefined
    if (gate === undefined || gate === '-1') output.push(field)
    else if (gate === styleId || (gate === 'default' && styleId === '0')) output.push({ key: field.key, condition: field.condition,
      value: children(field).filter(n => n.key !== 'style') })
  }
  return { key: visuals.key, value: output, condition: visuals.condition }
}

function fieldsFor(source, target, styleId) {
  let fields = source.fields
  // Older items may store styles directly on the item (e.g. Helm of the Static Lord).
  const legacy = find(fields, 'styles')
  if (legacy) {
    const visuals = children(find(fields, 'visuals'))
    fields = [...fields.filter(n => !['styles', 'visuals'].includes(n.key)),
      { key: 'visuals', value: find(visuals, 'styles') ? visuals : [...visuals, legacy] }]
  }
  // Accept schema variants with model/activity/particle modifiers outside visuals.
  const direct = fields.filter(n => /^asset_modifier\d*$/.test(n.key))
  if (direct.length) fields = [...fields.filter(n => n.key !== 'visuals' && !direct.includes(n)),
    { key: 'visuals', value: [...children(find(fields, 'visuals')), ...direct] }]
  const selected = children(find(children(find(fields, 'visuals')), 'styles')).find(n => n.key === styleId)
  const styleModel = find(children(selected), 'model_player')
  if (styleModel) fields = [...fields.filter(n => n.key !== 'model_player'), styleModel]
  const gates = children(find(fields, 'visuals')).filter(n => /^asset_modifier\d*$/.test(n.key))
    .map(n => scalar(children(n), 'style')).filter(g => g !== undefined)
  // Io 9235 has modifiers gated on zero but no styles table. A base definition
  // may never receive an equipped style, so make the selected modifiers unconditional.
  const active = styleId ?? (gates.length && gates.every(g => ['0', 'default', '-1'].includes(g)) ? '0' : undefined)
  const output = fields.filter(n => appearance.has(n.key)).map(n => {
    if (n.key === 'visuals' && active !== undefined) return styledVisuals(n, active)
    // A donor usable by multiple heroes must not broaden the default definition.
    if (n.key === 'used_by_heroes' && !target.isGlobal && (source.used.length !== 1 || source.used.includes('all'))) {
      return find(target.fields, 'used_by_heroes')
    }
    return n
  })
  for (const key of ['attributes', 'static_attributes']) {
    const donor = children(find(source.fields, key)).filter(n => visualAttributes.has(n.key))
    const existing = children(find(target.fields, key))
    if (!donor.length && !existing.some(n => visualAttributes.has(n.key))) continue
    output.push({ key, value: [...existing.filter(n => !visualAttributes.has(n.key)), ...donor] })
  }
  return output
}

function setField(record, key, replacement, edits) {
  const existing = children(record.node).filter(n => n.key === key)
  if (existing.length) {
    for (const [index, node] of existing.entries()) edits.push({ start: node.start, end: node.end, replacement: index ? '' : replacement })
  } else {
    const start = record.node.valueStart + 1
    edits.push({ start, end: start, replacement: ' ' + replacement + ' ' })
  }
}

const heroList = ids => ({ key: 'used_by_heroes', value: ids.map(key => ({ key, value: '1' })) })

/** Selections reference stable schema IDs. Omitting a slot leaves its bytes intact. */
export function patchItemsGame(schema, selections, affected = new Set()) {
  if (!Array.isArray(selections)) throw Error('Lista de seleções inválida.')
  const { text, records, catalog } = schema
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  const owners = new Map([catalog.global, ...catalog.heroes].map(h => [h.id, h]))
  const targets = new Set()
  const edits = []
  const exclude = new Map()
  const chosenSlots = new Set()
  let freeId = 65534
  for (const selection of selections) {
    const { hero, slot, itemId, styleId } = selection
    const group = owners.get(hero)?.slots.find(s => s.id === slot)
    if (!group) throw Error('Herói ou slot ausente no esquema atual: ' + hero + '/' + slot)
    if (itemId === null) continue
    const slotKey = hero + '/' + slot
    if (chosenSlots.has(slotKey)) throw Error('Slot selecionado mais de uma vez.')
    chosenSlots.add(slotKey)
    if (!group.defaultId && !group.scopedDefault) throw Error(slot + ': ' + group.reason)
    const item = group.items.find(i => i.id === String(itemId))
    if (!item) throw Error('Item incompatível com o herói ou slot: ' + itemId)
    const selectedStyle = styleId == null ? (item.styles.find(s => s.id === '0') || item.styles[0])?.id : String(styleId)
    if (selectedStyle !== undefined && !item.styles.some(s => s.id === selectedStyle)) throw Error('Estilo inválido: ' + selectedStyle)
    if (group.scopedDefault) {
      for (const id of group.defaultIds) {
        if (!exclude.has(id)) exclude.set(id, new Set())
        exclude.get(id).add(hero)
      }
      const donor = records.get(item.id)
      if (donor.used.length === 1 && donor.used[0] === hero) {
        // Keep the real donor ID and promote it only for its owning hero.
        setField(donor, 'baseitem', '"baseitem" "1"', edits)
        if (selectedStyle !== undefined) {
          const visual = fieldsFor(donor, donor, selectedStyle).find(n => n.key === 'visuals')
          setField(donor, 'visuals', render(visual, text, newline, 3), edits)
        }
        affected.add(item.id)
      } else {
        // A shared donor must keep its original scope. Give the hero a local base definition.
        while (freeId > 0 && records.has(String(freeId))) freeId--
        if (!freeId) throw Error('Sem ID local disponível para o slot ' + slot)
        const key = String(freeId--)
        const fields = fieldsFor(donor, donor, selectedStyle).filter(n => n.key !== 'used_by_heroes')
        const node = { key, value: [{ key: 'prefab', value: scalar(donor.fields, 'prefab') || 'default_item' },
          { key: 'name', value: donor.item.name }, { key: 'item_slot', value: slot }, { key: 'baseitem', value: '1' },
          heroList([hero]), ...fields] }
        edits.push({ start: donor.node.end, end: donor.node.end, replacement: newline + '\t\t' + render(node, text, newline, 2) })
        affected.add(key)
      }
      continue
    }
    if (targets.has(group.defaultId)) throw Error('Item padrão selecionado mais de uma vez.')
    targets.add(group.defaultId)
    affected.add(group.defaultId)
    const target = records.get(group.defaultId)
    const output = fieldsFor(records.get(item.id), target, selectedStyle)
    if (target.isGlobal && scalar(target.fields, 'item_slot') !== group.id) {
      output.push({ key: 'item_slot', value: group.id })
    }
    if (target.isGlobal) {
      const restriction = output.findIndex(n => n.key === 'used_by_heroes')
      if (restriction >= 0) output.splice(restriction, 1)
    }
    const changed = new Set([...appearance, ...output.map(n => n.key)])
    const pending = new Map()
    for (const n of output) {
      if (!pending.has(n.key)) pending.set(n.key, [])
      pending.get(n.key).push(render(n, text, newline, 3))
    }
    const separator = newline + '\t\t\t'
    for (const n of children(target.node)) {
      if (!changed.has(n.key) && !/^asset_modifier\d*$/.test(n.key)) continue
      edits.push({ start: n.start, end: n.end, replacement: (pending.get(n.key) || []).join(separator) })
      pending.delete(n.key)
    }
    if (pending.size) {
      const start = target.node.valueStart + 1
      edits.push({ start, end: start, replacement: separator + [...pending.values()].flat().join(separator) + newline })
    }
  }
  for (const [id, removed] of exclude) {
    const record = records.get(id)
    const eligible = record.used.includes('all') ? catalog.heroes.map(h => h.id) : record.heroIds
    const users = heroList(eligible.filter(h => !removed.has(h)))
    setField(record, 'used_by_heroes', render(users, text, newline, 3), edits)
    affected.add(id)
  }
  return edits.length ? spliceText(text, edits) : text
}
