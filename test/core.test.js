import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { crc32 } from 'node:zlib'
import { parseKV, children, find, scalar } from '../core/kv1.js'
import { openVpk, buildItemsVpk, ITEMS_PATH } from '../core/vpk.js'
import { parseItemsGame, loadGame } from '../core/catalog.js'
import { patchItemsGame } from '../core/patch.js'
import { installMod, installModWithReport, restoreGame, editGameInfo } from '../core/install.js'
import { compareSchemas, diagnose, sha } from '../core/diagnostics.js'
import { createIconReader } from '../core/icons.js'
import { writeZipStore, openZipStore } from '../core/zip.js'
import { createPack, readPack } from '../core/packs.js'
import { equipSet } from '../core/selections.js'

const hero = 'npc_dota_hero_earthshaker'
const used = '"used_by_heroes" { "' + hero + '" "1" }'
const source = '\uFEFF' + [
  '"items_game" {',
  '  prefabs { default_item { item_slot weapon baseitem 1 } wearable { item_slot weapon } arcana { prefab wearable item_slot hero_base } }',
  '  items {',
  '    1 { prefab default_item name "Base" item_slot hero_base model_player old',
  '        // Economia do item padrão',
  '        static_attributes { giftable 1 "model skin" 0 } portraits { old camera } ' + used + '}',
  '    2 { prefab arcana name "Planetfall" model_player new ' + used,
  '        static_attributes { giftable 0 "model skin" 2 } portraits { game "nova câmera" }',
  '        visuals { styles { 0 { name "First" skin 0 } 1 { name "Second" skin 3 unlock { gem 5 } } }',
  '          asset_modifier { type particle modifier shared }',
  '          asset_modifier { style 0 modifier old } asset_modifier { style 1 modifier selected } } }',
  '    3 { prefab default_item name "Totem" ' + used + ' }',
  '    4 { prefab wearable name "A // B \\"C\\"" ' + used + ' }',
  '    5 { item_slot weather baseitem 1 } 6 { item_slot weather visuals { asset_modifier { type weather weather_type 3 } } }',
  '    7 { item_slot taunt baseitem 1 used_by_heroes { all 1 } } 8 { item_slot taunt ' + used + ' }',
  '  }',
  '}',
].join('\r\n')
const selection = { hero, slot: 'hero_base', itemId: '2', styleId: '1' }
const originalInfo = '\uFEFF"GameInfo"\r\n{\r\n FileSystem { SearchPaths {\r\n\t// Game dota_custom\r\n\tGame dota\r\n\tGame core\r\n } }\r\n}\r\n'
const scratch = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-local-skins-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}
function fakeInstall(t, info = originalInfo) {
  const root = scratch(t)
  const dota = path.join(root, 'game/dota')
  fs.mkdirSync(dota, { recursive: true })
  fs.writeFileSync(path.join(dota, 'gameinfo.gi'), info)
  fs.writeFileSync(path.join(dota, 'pak01_dir.vpk'), buildItemsVpk(source))
  return root
}
const fields = (schema, id) => children(schema.records.get(id).node)

test('lê VPK instalado e cataloga prefab, estilos, slot global e slot herdado', t => {
  const { catalog } = loadGame(fakeInstall(t))
  const heroSlots = catalog.heroes[0].slots
  assert.equal(heroSlots.find(s => s.id === 'weapon').items[0].name, 'A // B "C"')
  assert.deepEqual(heroSlots.find(s => s.id === 'hero_base').items[0].styles.map(s => s.id), ['0', '1'])
  assert.equal(catalog.global.slots[0].defaultId, '5')
  assert.equal(heroSlots.find(s => s.id === 'taunt').defaultId, null)
  assert.equal(heroSlots.find(s => s.id === 'taunt').scopedTaunt, true)
})

test('resolve peças e padrões por tipo, preserva estilos e equipa o pacote em uma transação', () => {
  const text = source.replace('prefabs {', `player_loadout_slots { 0 cursor_pack 1 emblem 2 loading_screen }
    prefabs { bundle {} cursor_pack { item_slot cursor_pack } loading_screen { item_slot loading_screen }`)
    .replace('name "Base"', 'name "Base" image_inventory econ/default_items/base')
    .replace('    5 {', `    10 { prefab bundle item_slot weapon item_name "#Set" ${used}
      image_inventory econ/bundles/a bundle { Planetfall 1 "4" 1 Screen 1 } }
    11 { prefab loading_screen name Screen item_slot weapon ${used} }
    12 { prefab cursor_pack item_slot weapon baseitem 1 }
    13 { prefab cursor_pack visuals { asset_modifier { type cursor modifier cursor } } }
    14 { item_slot emblem }
    15 { prefab wearable item_type_name "#DOTA_WearableType_Alternate_Hero_Voice" item_slot weapon ${used} }
    5 {`)
  const schema = parseItemsGame(text, { tokens: new Map([['set', 'Conjunto']]) })
  const owner = schema.catalog.heroes[0]
  assert.deepEqual(owner.sets, [{ id: '10', name: 'Conjunto', rarity: 'common', iconPath: 'econ/bundles/a',
    items: [{ slot: 'hero_base', itemId: '2' }, { slot: 'weapon', itemId: '4' }] }])
  assert.deepEqual(owner.slots.find(s => s.id === 'weapon').items.map(i => i.id), ['4'])
  assert.equal(owner.slots.find(s => s.id === 'hero_base').defaultIconPath, 'econ/default_items/base')
  const globals = schema.catalog.global.slots
  assert.equal(globals.find(s => s.id === 'emblem').supported, false)
  assert.equal(globals.find(s => s.id === 'cursor_pack').defaultId, '12')
  const cursor = { hero: 'global', slot: 'cursor_pack', itemId: '13' }
  const previous = [cursor, { ...selection, styleId: null }]
  const choices = equipSet(previous, owner, '10', { 2: 1 })
  assert.deepEqual(choices, [cursor, selection, { hero, slot: 'weapon', itemId: '4', styleId: null }])
  assert.throws(() => equipSet(previous, owner, '10', { 2: 7 }), /Estilo/)
  assert.equal(previous[1].styleId, null)
  const after = parseItemsGame(patchItemsGame(schema, choices))
  assert.equal(scalar(fields(after, '12'), 'item_slot'), 'cursor_pack')
  assert.equal(scalar(fields(after, '1'), 'model_player'), 'new')
})

test('edita só o destino, conserva duplicatas e transpõe o estilo escolhido para o estilo ativo', () => {
  const before = parseItemsGame(source)
  const result = patchItemsGame(before, [selection])
  const after = parseItemsGame(result)
  const original = before.records.get('1').node, changed = after.records.get('1').node
  assert.equal(result.slice(0, changed.start), source.slice(0, original.start))
  assert.equal(result.slice(changed.end), source.slice(original.end))
  const target = fields(after, '1')
  assert.equal(scalar(target, 'model_player'), 'new')
  assert.equal(scalar(target, 'name'), 'Base')
  assert.equal(scalar(children(find(target, 'static_attributes')), 'giftable'), '1')
  assert.equal(scalar(children(find(target, 'static_attributes')), 'model skin'), '2')
  assert.equal(scalar(children(find(target, 'portraits')), 'game'), 'nova câmera')
  const visuals = children(find(target, 'visuals'))
  const styles = children(find(visuals, 'styles'))
  assert.deepEqual(styles.map(n => n.key), ['0'])
  assert.equal(scalar(children(styles[0]), 'skin'), '3')
  assert.equal(find(children(styles[0]), 'unlock'), undefined)
  assert.deepEqual(visuals.filter(n => n.key === 'asset_modifier').map(n => scalar(n.value, 'modifier')), ['shared', 'selected'])
  assert.equal(scalar(children(visuals.at(-1)), 'style'), undefined)
  assert.ok(result.includes('// Economia do item padrão'))
})

test('valida seleção, estilos, defaults compartilhados, IDs antigos e sintaxe', () => {
  const schema = parseItemsGame(source)
  for (const proposed of [[{ ...selection, styleId: '7' }], [{ ...selection, slot: 'weapon' }],
    [{ ...selection, itemId: '99' }], [selection, selection], [{ hero, slot: 'taunt', itemId: '2' }]]) {
    assert.throws(() => patchItemsGame(schema, proposed))
  }
  assert.equal(patchItemsGame(schema, []), source)
  assert.equal(patchItemsGame(schema, [{ ...selection, itemId: null }]), source)
  assert.throws(() => parseKV('item { key "incompleto'))
  assert.throws(() => parseItemsGame(source.replace('arcana { prefab wearable', 'arcana { prefab arcana')))
})

test('provocações simultâneas têm IDs reais e preservam o padrão dos demais heróis', () => {
  const io = 'npc_dota_hero_wisp', axe = 'npc_dota_hero_axe'
  const text = source.replace('8 { item_slot taunt', '9 { item_slot taunt used_by_heroes { ' + io + ' 1 } } ' +
    '10 { item_slot head used_by_heroes { ' + axe + ' 1 } } 8 { visuals { asset_modifier { type activity gesture 1 } } item_slot taunt')
  const s = parseItemsGame(text)
  const choices = [{ hero, slot: 'taunt', itemId: '8' }, { hero: io, slot: 'taunt', itemId: '9' }]
  const after = parseItemsGame(patchItemsGame(s, choices))
  assert.deepEqual(after.records.get('7').used, [axe])
  for (const c of choices) assert.equal(after.catalog.heroes.find(h => h.id === c.hero).slots.find(s => s.id === 'taunt').defaultId, c.itemId)
  assert.equal(scalar(children(find(children(find(fields(after, '8'), 'visuals')), 'asset_modifier')), 'gesture'), '1')
  const single = parseItemsGame(patchItemsGame(s, choices.slice(1)))
  assert.ok(single.records.get('7').used.includes(hero))
  assert.equal(single.records.get('8').isDefault, false)
})

test('equipar um mascote de conjunto mantém o padrão compartilhado nos demais heróis', () => {
  const other = 'npc_dota_hero_marci'
  const schema = parseItemsGame(source.replace('    5 {', `    20 { item_slot summon baseitem 1
    used_by_heroes { ${hero} 1 ${other} 1 } }
    21 { name Pet item_slot summon ${used} }
    22 { name Set bundle { Pet 1 } }
    5 {`))
  const owner = schema.catalog.heroes.find(h => h.id === hero)
  const after = parseItemsGame(patchItemsGame(schema, equipSet([], owner, '22')))
  assert.deepEqual(after.records.get('20').used, [other])
  assert.equal(after.catalog.heroes.find(h => h.id === hero).slots.find(s => s.id === 'summon').defaultId, '21')
})

test('diagnóstico identifica perda de montagem, dados antigos, corrupção e recuperação do backup', async t => {
  const info = originalInfo.replace('\tGame core', '\tMod dota\r\n\tGame core')
  const root = fakeInstall(t, info)
  const config = path.join(root, 'game/dota/gameinfo.gi'), log = path.join(root, 'game/dota/console.log')
  fs.writeFileSync(log, 'mounted game/dota_custom/pak01_dir.vpk\n')
  const mod = await installMod(root, patchItemsGame(parseItemsGame(source), [selection]))
  let report = diagnose(root)
  assert.equal(report.ok, true)
  assert.match(report.checks[0].detail, /mod dota_custom na linha/)
  assert.match(report.client, /Sem registro/)
  fs.appendFileSync(log, 'GAME "game/dota_custom/pak01_dir.vpk"\n')
  assert.match(diagnose(root).client, /registrou o VPK/)
  fs.writeFileSync(config, info)
  assert.equal(diagnose(root).checks[0].ok, false)
  fs.writeFileSync(path.join(root, 'game/dota/pak01_dir.vpk'), buildItemsVpk(source + '\n'))
  assert.match(diagnose(root).checks[2].detail, /mudou/)
  const data = fs.readFileSync(mod)
  data[data.length - 50] ^= 1
  fs.writeFileSync(mod, data)
  assert.equal(diagnose(root).checks[1].ok, false)
  data[data.length - 50] ^= 1
  fs.writeFileSync(mod, data)
  fs.writeFileSync(config, 'GameInfo {')
  await restoreGame(root, true)
  assert.equal(fs.readFileSync(config, 'utf8'), info)
  assert.equal(fs.existsSync(mod), false)
  assert.ok(fs.readdirSync(path.dirname(config)).some(n => n.includes('.recovery-')))
})

test('pré-validação recusa arquivo truncado, perda de seção e alteração fora do escopo', () => {
  assert.throws(() => compareSchemas(source, source.slice(0, -2)))
  assert.throws(() => compareSchemas(source, source.replace('prefabs {', 'outra {')), /Seções/)
  assert.throws(() => compareSchemas(source, source.replace('model_player old', 'model_player other'), new Set(['2'])), /fora da seleção/)
})

test('Io sem tabela de estilos mantém modelo, partículas e modificadores numerados sem condicionar a um estilo equipado', () => {
  const data = source.replace('model_player new', 'model_player new asset_modifier22 { type particle modifier tether style 0 }')
    .replace('styles { 0 { name "First" skin 0 } 1 { name "Second" skin 3 unlock { gem 5 } } }', '')
    .replace('style 1 modifier selected', 'style 0 modifier selected')
  const result = parseItemsGame(patchItemsGame(parseItemsGame(data), [{ ...selection, styleId: null }]))
  const target = fields(result, '1'), visual = children(find(target, 'visuals'))
  assert.equal(scalar(target, 'model_player'), 'new')
  assert.equal(scalar(children(find(visual, 'asset_modifier22')), 'modifier'), 'tether')
  assert.ok(visual.every(n => scalar(children(n), 'style') === undefined))
})

test('aplica estilos legados definidos diretamente no item e conserva o escopo do padrão', () => {
  const legacy = source.replace('visuals { styles', 'styles').replace('asset_modifier { type particle', 'visuals { asset_modifier { type particle')
    .replace('model_player new ' + used, 'model_player new used_by_heroes { all 1 }')
  const before = parseItemsGame(legacy)
  const after = parseItemsGame(patchItemsGame(before, [selection]))
  const target = fields(after, '1')
  assert.deepEqual(children(find(target, 'used_by_heroes')).map(n => n.key), [hero])
  assert.equal(scalar(children(children(find(children(find(target, 'visuals')), 'styles'))[0]), 'skin'), '3')
})

test('VPK v2 multipartes combina preload e segmento externo e verifica CRC e limites', t => {
  const dir = scratch(t)
  const archive = path.join(dir, 'pak01_dir.vpk'), part = path.join(dir, 'pak01_007.vpk')
  const body = Buffer.from('conteúdo aqui')
  const entry = Buffer.alloc(18)
  entry.writeUInt32LE(crc32(body)); entry.writeUInt16LE(2, 4); entry.writeUInt16LE(7, 6)
  entry.writeUInt32LE(3, 8); entry.writeUInt32LE(body.length - 2, 12); entry.writeUInt16LE(65535, 16)
  const tree = Buffer.concat([Buffer.from('txt\0scripts/items\0items_game\0'), entry, body.subarray(0, 2), Buffer.alloc(3)])
  const header = Buffer.alloc(28)
  header.writeUInt32LE(0x55aa1234); header.writeUInt32LE(2, 4); header.writeUInt32LE(tree.length, 8)
  fs.writeFileSync(archive, Buffer.concat([header, tree]))
  fs.writeFileSync(part, Buffer.concat([Buffer.alloc(3), body.subarray(2)]))
  assert.deepEqual(openVpk(archive).read(ITEMS_PATH), body)
  fs.writeFileSync(part, Buffer.alloc(body.length + 1))
  assert.throws(() => openVpk(archive).read(ITEMS_PATH), /CRC32/)
  fs.truncateSync(part, 1)
  assert.throws(() => openVpk(archive).read(ITEMS_PATH), /Intervalo/)
})

test('aplica, reaplica e restaura em presença de atualização da Valve', async t => {
  const root = fakeInstall(t)
  const schema = loadGame(root)
  const patched = patchItemsGame(schema, [selection, { hero: 'global', slot: 'weather', itemId: '6' }])
  const file = path.join(root, 'game/dota/gameinfo.gi')
  fs.chmodSync(file, 0o444)
  const mod = await installMod(root, patched)
  fs.chmodSync(mod, 0o444)
  assert.equal(openVpk(mod).read(ITEMS_PATH).toString(), patched)
  assert.equal(fs.readFileSync(file + '.local-skins.bak', 'utf8'), originalInfo)
  const first = fs.readFileSync(file, 'utf8')
  assert.ok(first.indexOf('dota_custom // dota-local-skin-changer') < first.indexOf('\tGame dota\r\n'))
  await installMod(root, source)
  assert.equal(fs.readFileSync(file, 'utf8'), first)
  assert.equal(openVpk(mod).read(ITEMS_PATH).toString(), source)
  fs.appendFileSync(file, '// Atualização do jogo\r\n')
  await restoreGame(root); await restoreGame(root)
  assert.equal(fs.readFileSync(file, 'utf8'), originalInfo + '// Atualização do jogo\r\n')
  assert.equal(fs.existsSync(mod), false)
})

test('substitui um pak01_dir.vpk antigo mesmo com conteúdo idêntico e atualiza o timestamp', async t => {
  const root = fakeInstall(t)
  const patched = patchItemsGame(loadGame(root), [selection])
  const file = await installMod(root, patched)
  const old = new Date(Date.now() - 3600_000)
  fs.utimesSync(file, old, old)
  await installMod(root, patched)
  assert.ok(fs.statSync(file).mtimeMs > old.getTime() + 60_000)
  const other = patchItemsGame(loadGame(root), [selection, { hero: 'global', slot: 'weather', itemId: '6' }])
  fs.utimesSync(file, old, old)
  const size = fs.statSync(file).size
  await installMod(root, other)
  assert.equal(openVpk(file).read(ITEMS_PATH).toString(), other)
  assert.notEqual(fs.statSync(file).size, size)
  assert.ok(fs.statSync(file).mtimeMs > old.getTime() + 60_000)
})

test('monta dota_custom também em gameinfo_branchspecific.gi quando ele define SearchPaths e restaura', async t => {
  const root = fakeInstall(t)
  const branch = path.join(root, 'game/dota/gameinfo_branchspecific.gi')
  const text = '"GameInfo"\r\n{\r\n FileSystem { SearchPaths {\r\n\tGame\tOutroApp\r\n\tGame\tdota\r\n\tGame\tcore\r\n } }\r\n}\r\n'
  fs.writeFileSync(branch, text)
  await installMod(root, patchItemsGame(loadGame(root), [selection]))
  const edited = fs.readFileSync(branch, 'utf8')
  assert.ok(edited.indexOf('dota_custom') > edited.indexOf('OutroApp') && edited.indexOf('dota_custom') < edited.indexOf('Game\tdota\r\n'))
  assert.equal(diagnose(root).checks.find(c => c.label === 'gameinfo_branchspecific.gi').ok, true)
  await restoreGame(root)
  assert.equal(fs.readFileSync(branch, 'utf8'), text)
})

test('protege VPK alterado na restauração e montagem de terceiros', async t => {
  const root = fakeInstall(t)
  assert.throws(() => editGameInfo(originalInfo.replace('\tGame core', '\tGame dota_custom\r\n\tGame core'), true), /outra configuração/)
  const file = await installMod(root, source)
  fs.writeFileSync(file, 'Arquivo externo')
  await assert.rejects(() => restoreGame(root), /alterado fora/)
  assert.equal(fs.readFileSync(file, 'utf8'), 'Arquivo externo')
})

test('limpa resíduos de VPK e temporários de builds com ou sem recibo', async t => {
  const root = fakeInstall(t)
  const dir = path.join(root, 'game/dota_custom')
  fs.mkdirSync(dir)
  for (const name of ['pak01_dir.vpk', 'pak01_000.vpk', 'pak01.vpk', '.local-skins-12345678-1234-1234-1234-123456789abc.tmp']) {
    fs.writeFileSync(path.join(dir, name), 'build anterior')
  }
  fs.chmodSync(path.join(dir, 'pak01_000.vpk'), 0o444)
  const archive = await installMod(root, source)
  assert.equal(openVpk(archive).read(ITEMS_PATH).toString(), source)
  fs.writeFileSync(path.join(dir, 'pak01_001.vpk'), 'parte antiga')
  await installMod(root, source)
  assert.deepEqual(fs.readdirSync(dir).sort(), ['.dota-local-skins.json', 'pak01_dir.vpk'])
  await restoreGame(root)
  assert.equal(fs.existsSync(dir), false)
})

test('bloqueia arquivos e subpastas desconhecidos e os preserva ao forçar a aplicação', async t => {
  const root = fakeInstall(t)
  const dir = path.join(root, 'game/dota_custom')
  fs.mkdirSync(dir)
  fs.writeFileSync(path.join(dir, 'externo.vpk'), 'outro pacote')
  fs.mkdirSync(path.join(dir, 'pak01_000.vpk'))
  await assert.rejects(() => installMod(root, source), { code: 'CUSTOM_DIR_CONTENTS' })
  assert.equal(fs.readFileSync(path.join(root, 'game/dota/gameinfo.gi'), 'utf8'), originalInfo)
  const { archive, preserved } = await installModWithReport(root, source, { force: true })
  assert.equal(openVpk(archive).read(ITEMS_PATH).toString(), source)
  assert.equal(path.dirname(preserved), path.dirname(dir))
  assert.equal(fs.readFileSync(path.join(preserved, 'externo.vpk'), 'utf8'), 'outro pacote')
  assert.ok(fs.statSync(path.join(preserved, 'pak01_000.vpk')).isDirectory())
})

test('repete renomeação bloqueada e preserva o estado anterior se o bloqueio persistir', async t => {
  const root = fakeInstall(t)
  const file = await installMod(root, source)
  const before = fs.readFileSync(file)
  const receipt = path.join(path.dirname(file), '.dota-local-skins.json')
  const beforeReceipt = fs.readFileSync(receipt)
  const rename = fs.promises.rename
  let locks = 5
  t.mock.method(fs.promises, 'rename', async (from, to) => {
    if (to === file && locks-- > 0) throw Object.assign(Error('arquivo em uso'), { code: 'EPERM' })
    await rename(from, to)
  })
  const patched = patchItemsGame(loadGame(root), [selection])
  await assert.rejects(installMod(root, patched), /Windows bloqueou.*pak01_dir/)
  assert.deepEqual(fs.readFileSync(file), before)
  assert.deepEqual(fs.readFileSync(receipt), beforeReceipt)
  locks = 1
  await installMod(root, patched)
  assert.equal(openVpk(file).read(ITEMS_PATH).toString(), patched)
})

test('ícones funcionam sem CLI quando em cache e invalidam por CRC do recurso', async t => {
  const root = fakeInstall(t), cache = path.join(root, 'cache/icons')
  const entry = 'panorama/images/econ/test_png.vtex_c'
  function texture(data) {
    const record = Buffer.alloc(18)
    record.writeUInt32LE(crc32(data)); record.writeUInt16LE(32767, 6)
    record.writeUInt32LE(data.length, 12); record.writeUInt16LE(65535, 16)
    const tree = Buffer.concat([Buffer.from('vtex_c\0panorama/images/econ\0test_png\0'), record, Buffer.alloc(3)])
    const header = Buffer.alloc(12)
    header.writeUInt32LE(0x55aa1234); header.writeUInt32LE(1, 4); header.writeUInt32LE(tree.length, 8)
    fs.writeFileSync(path.join(root, 'game/dota/pak01_dir.vpk'), Buffer.concat([header, tree, data]))
  }
  const data = Buffer.from('vtex')
  texture(data)
  const icons = createIconReader(root, cache, '')
  const get = async image => (await icons.get([image]))[image]
  assert.deepEqual(icons.lookup(['econ/test']), {})
  assert.match((await get('econ/test')).reason, /Configure/)
  assert.match((await get('econ/missing')).reason, /ausente/)
  assert.deepEqual(await get('econ/../../arquivo'), {})
  fs.mkdirSync(cache, { recursive: true })
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
  fs.writeFileSync(path.join(cache, sha(entry + ':' + crc32(data)) + '.png'), pixel)
  assert.ok(icons.lookup(['econ/test'])['econ/test'].url.startsWith('data:image/png;base64,'))
  assert.deepEqual(icons.lookup(['econ/test'])['econ/test'], await get('econ/test'))
  const progress = []
  await icons.index(['econ/test'], (...update) => progress.push(update))
  assert.deepEqual(progress.at(-1), ['concluído', 1, 1])
  texture(Buffer.from('atualizado'))
  await assert.rejects(icons.index(['econ/test'], () => {}), /Configure/)
  assert.match((await get('econ/test')).reason, /Configure/)
})

test('packs JSON preservam heróis, seleções globais e estilos e rejeitam dados incompatíveis', () => {
  const pack = createPack('  Earthshaker + clima  ', [selection, { hero: 'global', slot: 'weather', itemId: 6 }])
  assert.deepEqual(readPack('\uFEFF' + JSON.stringify(pack)), {
    ...pack, name: 'Earthshaker + clima', selections: [selection, { hero: 'global', slot: 'weather', itemId: '6', styleId: null }],
  })
  assert.throws(() => readPack('{'), /JSON válido/)
  assert.throws(() => readPack(JSON.stringify({ ...pack, version: 2 })), /incompatível/)
  assert.throws(() => createPack('Duplicado', [selection, selection]), /slot duplicado/)
  assert.throws(() => createPack('Inválido', [{ ...selection, itemId: '../2' }]), /seleção inválida/)
})

test('ícones: pacote embutido tem prioridade, depois cache de disco e, sem CLI, falha silenciosa', async t => {
  const root = fakeInstall(t), cache = path.join(root, 'cache/icons')
  const data = Buffer.from('vtex')
  const record = Buffer.alloc(18)
  record.writeUInt32LE(crc32(data)); record.writeUInt16LE(32767, 6)
  record.writeUInt32LE(data.length, 12); record.writeUInt16LE(65535, 16)
  const tree = Buffer.concat([Buffer.from('vtex_c\0panorama/images/econ\0test_png\0'), record, Buffer.alloc(3)])
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x55aa1234); header.writeUInt32LE(1, 4); header.writeUInt32LE(tree.length, 8)
  fs.writeFileSync(path.join(root, 'game/dota/pak01_dir.vpk'), Buffer.concat([header, tree, data]))
  const key = sha('panorama/images/econ/test_png.vtex_c:' + crc32(data))
  const zip = path.join(root, 'icons-pack.zip'), webp = Buffer.from('RIFF....WEBPfake')
  writeZipStore(zip, [[key + '.webp', webp], ['outro.webp', Buffer.from('x')]])
  const reader = openZipStore(zip)
  assert.deepEqual(reader.read(key + '.webp'), webp)
  assert.equal(reader.read('ausente.webp'), null)
  reader.close()

  const icons = createIconReader(root, cache, '', undefined, zip)
  const expected = { url: 'data:image/webp;base64,' + webp.toString('base64') }
  assert.deepEqual(icons.lookup(['econ/test']), { 'econ/test': expected })
  assert.deepEqual((await icons.get(['econ/test']))['econ/test'], expected)
  const progress = []
  await icons.index(['econ/test'], (...update) => progress.push(update))
  assert.deepEqual(progress.at(-1), ['concluído', 1, 1])

  // Sem o pacote: cache de disco e, sem CLI, o aviso de fallback.
  const plain = createIconReader(root, cache, '', undefined, path.join(root, 'nao-existe.zip'))
  assert.deepEqual(plain.lookup(['econ/test']), {})
  assert.match((await plain.get(['econ/test']))['econ/test'].reason, /Configure/)
  fs.mkdirSync(cache, { recursive: true })
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
  fs.writeFileSync(path.join(cache, key + '.png'), pixel)
  assert.ok(plain.lookup(['econ/test'])['econ/test'].url.startsWith('data:image/png;base64,'))
  // Ícone ausente do pacote usa o cache de disco.
  const partial = path.join(root, 'parcial.zip')
  writeZipStore(partial, [['outro.webp', Buffer.from('x')]])
  const mixed = createIconReader(root, cache, '', undefined, partial)
  assert.ok(mixed.lookup(['econ/test'])['econ/test'].url.startsWith('data:image/png;base64,'))
})
