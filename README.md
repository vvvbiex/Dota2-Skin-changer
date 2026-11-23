# Dota 2 Local Skin Changer

Aplicativo desktop para **Windows x64** que permite personalizar cosméticos do Dota 2 localmente — incluindo Arcanas, Personas, conjuntos completos, estilos, entregadores, sentinelas, terrenos, locutores, trilhas sonoras e provocações (com prévia de áudio e vídeo).

> [!WARNING]
> **Aviso importante sobre partidas online e riscos**
>
> Este aplicativo modifica arquivos locais da instalação do Dota 2 (`game/dota/gameinfo.gi`, `game/dota/gameinfo_branchspecific.gi`, `game/bin/win64/dota.signatures`) e cria o pacote local `game/dota_custom/pak01_dir.vpk`.
>
> - Todas as alterações são **exclusivamente locais (client-side)**: apenas você vê os cosméticos modificados, nenhum item é adicionado ao seu inventário Steam e não há qualquer vantagem de jogabilidade.
> - **Uso por sua conta e risco:** a modificação de arquivos do cliente e de assinaturas **não é oficialmente suportada pela Valve**. Atualizações do Dota 2 ou mudanças nas verificações de integridade e no sistema antitrapaça (VAC) podem fazer o mod deixar de carregar, bloquear a busca de partidas até a restauração ou, em último caso, resultar em penalidades na conta.
> - Sempre **feche o Dota 2** antes de aplicar ou restaurar alterações. Caso queira voltar ao estado original antes de jogar partidas competitivas ou após um patch do jogo, use a função de restauração descrita abaixo.

## Instalação (via Releases)

1. Acesse a aba [**Releases**](https://github.com/vvvbiex/Dota2-Skin-changer/releases) deste repositório e baixe o instalador `Dota-2-Local-Skin-Changer-Setup.exe` da versão mais recente.
2. Execute o instalador, escolha o diretório desejado e abra o aplicativo ao concluir (ou pelo atalho na Área de Trabalho).
   - O instalador já acompanha o pacote de ícones embutido e o `Source2Viewer-CLI.exe` — nenhuma configuração manual adicional é necessária.
3. Na primeira abertura, o aplicativo detecta automaticamente a pasta `dota 2 beta` da sua biblioteca Steam. Se precisar indicar outro caminho, vá em **Configurações → Selecionar pasta**.

## Como usar

1. **Feche o Dota 2 completamente.**
2. No **Catálogo**, navegue por **Heróis** ou **Globais** (terrenos, climas, entregadores, sentinelas, locutores, músicas, cursores, etc.).
3. Escolha itens individuais, aplique **Conjuntos** completos e selecione o **estilo** desejado quando houver variantes.
   - Itens com falas, locutores e trilhas sonoras possuem o botão **Prévia** para ouvir diretamente do VPK do jogo.
   - Provocações possuem o botão **Vídeo** (com prévia da Liquipedia Dota 2 Wiki em cache local sincronizada com o áudio do VPK).
4. Opcionalmente, salve, exporte ou importe suas combinações em **Predefinições** (`.json`).
5. Clique em **Aplicar** ou **Aplicar e Jogar** no topo. O aplicativo gera `game/dota_custom/pak01_dir.vpk`, ajusta os `SearchPaths` e as assinaturas locais e valida a gravação em disco.

> [!NOTE]
> O patch substitui a definição do item **padrão** de cada slot. Se você já tiver um cosmético da sua conta Steam equipado naquele slot dentro do Dota 2, o item equipado pode ter prioridade visual — basta equipar o item padrão no slot para ver a skin local.

## Restaurar o estado original do jogo

Para remover completamente todas as modificações feitas pelo aplicativo:

1. **Feche o Dota 2 completamente.**
2. Abra **Configurações → Restaurar jogo**.
3. Clique em **Restaurar gameinfo.gi e limpar mods**.

O que essa ação faz:
- Remove as linhas adicionadas pelo aplicativo em `game/dota/gameinfo.gi` e `game/dota/gameinfo_branchspecific.gi`, preservando eventuais atualizações feitas pela Valve.
- Remove o pacote identificado pelo recibo e o próprio recibo. Se houver outros dados em `game/dota_custom/`, como as subpastas `save` e `rpt`, eles são preservados. O app remove a pasta quando ela fica vazia.
- Remove as linhas adicionadas pelo aplicativo em `game/bin/win64/dota.signatures` e limpa o recibo/backup de assinaturas.
- Preserva suas predefinições salvas no aplicativo (`%APPDATA%`).

Se o VAC informar que não conseguiu verificar a máquina, conclua a restauração acima. Depois, na biblioteca Steam, abra **Dota 2 → Propriedades → Arquivos instalados → Verificar integridade dos arquivos do jogo**. Aguarde o término e inicie o Dota 2 diretamente pela biblioteca, sem reaplicar as skins.

Se o `gameinfo.gi` estiver ausente ou corrompido, utilize **Configurações → Recuperar gameinfo.gi do backup**.

## Desenvolvimento local

Requisitos: **Windows x64** e **Node.js 22.12+**.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd start
```

- `npm.cmd run dev` — recompila a interface em modo watch durante o desenvolvimento.
- `npm.cmd run build:renderer` — compila apenas o bundle da interface em `dist/`.
- `npm.cmd run build:exe` — gera o instalador NSIS `Dota-2-Local-Skin-Changer-Setup.exe` na raiz do projeto.

## Licença, créditos e aviso legal

- Distribuído sob a licença **MIT** — consulte [`LICENSE`](LICENSE).
- Este projeto é independente e **não é afiliado, endossado ou patrocinado pela Valve Corporation**. Dota 2 é uma marca registrada da Valve Corporation.
- O empacotamento inclui `Source2Viewer-CLI` do projeto [ValveResourceFormat](https://github.com/ValveResourceFormat/ValveResourceFormat) (licença MIT — avisos de terceiros em [`tools/THIRD_PARTY_NOTICES.txt`](tools/THIRD_PARTY_NOTICES.txt)).
- As prévias de vídeo de provocações são obtidas sob demanda da [Liquipedia Dota 2 Wiki](https://liquipedia.net/dota2/).
