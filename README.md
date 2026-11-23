# Dota 2 Local Skin Changer

Aplicativo desktop para Windows x64, com catálogo extraído da instalação do Dota 2, seleção por slot e presets em JSON. A interface usa os nomes em português brasileiro quando disponíveis e recorre à localização inglesa e ao nome interno do item.

## Usar no Windows

1. Baixe `Dota-2-Local-Skin-Changer-Setup.exe` pela Release do GitHub ou use o instalador gerado na raiz do projeto. Execute o assistente, escolha a pasta e abra o aplicativo ao concluir ou pelo atalho no desktop. A primeira leitura usa as bibliotecas da Steam. Em **Configurações**, **Selecionar pasta** permite indicar manualmente o diretório `dota 2 beta`.
2. No **Catálogo**, abra um herói ou uma categoria de **Globais**. Escolha o cosmético no overlay e feche-o para selecionar o estilo, quando disponível. Para o exemplo do Earthshaker, escolha **Forma base → Domínio Planetar → 2 · Declínio Ardente**.
3. Em **Presets / Packs**, dê um nome à seleção e clique em **Salvar Pack**. **Carregar** recupera a seleção para revisão. Use **Exportar Pack (.json)** e **Importar Pack (.json)** para transferir as escolhas.
4. Com o jogo fechado, clique em **Aplicar mods** e confira o relatório. Use **Jogar** no cabeçalho para iniciar o Dota pela Steam. Cada aplicação relê o VPK original e gera o conjunto completo de escolhas atual. Para desativar todos os mods, use **Restaurar gameinfo.gi e limpar mods** em **Configurações**.

Para obter ícones, extraia o CLI Windows x64 do ValveResourceFormat e selecione seu executável em **Configurações**. A versão 21.1 usa o nome `Source2Viewer-CLI.exe`. O nome antigo `Decompiler.exe` também é aceito. [Distribuições oficiais do ValveResourceFormat](https://github.com/ValveResourceFormat/ValveResourceFormat/releases)

O contexto atualizado da arquitetura e o procedimento de diagnóstico na pasta do jogo estão em [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

O patch atua sobre a definição do item padrão. Um cosmético da conta equipado nesse mesmo slot usa sua própria definição e pode ter prioridade. Qualquer entidade que use a definição padrão modificada pode exibir a troca no cliente local. Inventário e equipamento da conta Steam são gerenciados pelo jogo.

## Estrutura do projeto

```text
core/
  vpk.js          Leitura VPK v1/v2 e geração do VPK local
  kv1.js          Parser KeyValues com chaves repetidas, comentários e posições
  catalog.js      Extração, herança de prefabs, metadados de heróis e catálogo
  patch.js        Validação da seleção e substituição dos campos visuais
  install.js      Detecção Steam, montagem, backup e restauração
  diagnostics.js  Inspeção de SearchPaths, VPK, KV1 e evidência do cliente
  icons.js        Extração, conversão e cache de PNGs
electron/
  main.js         Janela, seleção de pasta, IPC e persistência de presets
  preload.cjs     API restrita para a interface
  worker.js       Extração e aplicação fora da thread da janela
  icon-worker.js  Conversão de texturas sob demanda
src/
  main.jsx        Navegação, barra de status e estado das seleções
  Catalog.jsx     Biblioteca de heróis e categorias globais
  Hero.jsx        Equipamento, limpeza por herói e estilos
  ItemPicker.jsx  Overlay de seleção com troca rápida de slots
  Presets.jsx     Seleção atual e packs salvos
  Settings.jsx    Instalação, CLI, diagnóstico e restauração
  style.css       Tema e integração Tailwind
scripts/
  start.js        Inicialização local do Electron
  build-exe.js    Empacotamento do instalador NSIS Windows
  release-github.js Publicação do instalador NSIS no GitHub
test/
  core.test.js    Testes de VPK, KV1, catálogo, patch e instalação
index.html
vite.config.js
package.json
package-lock.json
.gitignore
README.md
dist/             Interface compilada pelo Vite
release/          Saída temporária do empacotador
```

## Dependências e execução

| Camada | Dependências NPM |
| --- | --- |
| Interface | `react`, `react-dom` |
| Build da interface | `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite` |
| Desktop e distribuição | `electron`, `electron-builder` |
| Leitura, patch e gravação | APIs nativas do Node.js, incluindo `node:fs`, `node:path`, `node:crypto` e `node:zlib` |

As versões resolvidas estão no lockfile. Os módulos de VPK e KV1 estão incluídos no projeto. O parser mantém cada ocorrência de uma chave, requisito para itens com muitos blocos homônimos de partículas, sons e modelos.

Com Node.js 22.12 ou superior, na raiz do projeto, execute os comandos necessários.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd start
```

Use `npm.cmd run dev` para recompilar a interface durante a edição e recarregue a janela com Ctrl+R. `npm.cmd run build:exe` gera o instalador NSIS x64 na raiz e limpa `release/`. O executável distribuído já contém o runtime. As imagens dos heróis são carregadas da CDN da Valve. Quando a CDN está indisponível, os cartões exibem as iniciais.

## Usar o backend diretamente

O exemplo abaixo funciona como um módulo ES a partir da raiz do projeto. Ele produz o texto modificado e o VPK em memória.

```js
import { loadGame } from './core/catalog.js'
import { patchItemsGame } from './core/patch.js'
import { buildItemsVpk } from './core/vpk.js'
import { detectDota } from './core/install.js'

const root = detectDota()
if (!root) throw new Error('Informe o caminho da instalação do Dota 2.')
const schema = loadGame(root)
const earthshaker = schema.catalog.heroes.find(h => h.id === 'npc_dota_hero_earthshaker')
console.log(JSON.stringify(earthshaker.slots.find(s => s.id === 'hero_base'), null, 2))

const selections = [{
  hero: earthshaker.id,
  slot: 'hero_base',
  itemId: '12692',
  styleId: '1',
}]
const patchedText = patchItemsGame(schema, selections)
const vpk = buildItemsVpk(patchedText)
console.log(vpk.length)
```

- `loadGame(root)` extrai `scripts/items/items_game.txt` de `game/dota/pak01_dir.vpk`, combina bytes de preload com segmentos numerados ou internos e verifica CRC32. Lê também as definições individuais referenciadas por `npc_heroes.txt`, os slots declarados e os tokens de localização.
- `parseItemsGame(text, options?)` aceita um esquema já extraído. `schema.catalog` é serializável em JSON. Expõe `heroes[]` e `global`. Cada slot contém `id`, `defaultId`, `defaultIds[]`, `items[]` e, quando necessário, o motivo de indisponibilidade. Cada item inclui `id`, `name`, `rarity` e `styles[]`. Os atributos primários vêm dos arquivos de heróis, que também podem ser fornecidos pela opção `heroDefinitions`.
- `patchItemsGame(schema, selections)` valida herói, slot, doador, padrão e estilo antes de devolver o texto. Um slot omitido ou com `itemId: null` mantém a definição original. Use `hero: 'global'` para terreno, clima, entregador e sentinela. Os nomes dos slots vêm do esquema, incluindo `persona_selector` e variantes como `weapon_persona_1`.
- Os IDs de estilo são os do arquivo. O segundo estilo de Planetfall tem ID `"1"`. O patch leva a variante escolhida à posição ativa `"0"` no destino, mantém seus modelos, skin e parâmetros visuais, filtra modificadores das demais variantes e remove a condição de estilo dos modificadores selecionados. A cópia preserva os modificadores comuns e as chaves repetidas. O ID, o nome, a economia e as capacidades do item padrão são preservados.
- Para provocações com padrão compartilhado, o patch seleciona um padrão por herói e conserva a definição compartilhada para os demais. Nos outros slots, a aplicação exige um padrão inequívoco. Um preset com item removido, estilo inexistente ou destino ambíguo interrompe a aplicação antes da gravação.

## Instalação e restauração

`await installMod(root, patchedText)` gera `game/dota_custom/pak01_dir.vpk` v2 e registra `Game dota_custom` antes de `Game dota` em `FileSystem/SearchPaths`. Quando existe `Mod dota`, adiciona também `Mod dota_custom` antes dele. A primeira aplicação salva `game/dota/gameinfo.gi.local-skins.bak`. O recibo contém o SHA-256 do pacote e do esquema de origem.

`await restoreGame(root)` remove as linhas identificadas pelo aplicativo e os arquivos do mod. A restauração edita o `gameinfo.gi` atual para preservar alterações posteriores da Valve. O primeiro backup e os presets continuam disponíveis. O aplicativo verifica conflitos com pastas, montagens e VPKs de terceiros antes de escrever.

## Verificação

A suíte automatizada usa arquivos temporários. Ela cobre arquivos multipartes com preload e CRC, chaves repetidas, modelos por estilo, slots herdados, estilos legados, metadados econômicos, conflitos com outros mods e restauração após uma atualização simulada.

Na instalação utilizada para a verificação inicial, o catálogo continha 127 heróis e 26.664 definições de itens. No teste de Planetfall, o VPK gerado foi reaberto e as outras 26.663 definições foram comparadas byte a byte. A definição `855` recebeu a skin `1` e o nível de Arcana `2`. A aplicação e a restauração foram verificadas em uma cópia temporária do diretório de destino. A aparência em uma partida depende do carregamento do VPK pela versão do cliente e ainda requer validação dentro do jogo.
