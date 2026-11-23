import React from 'react'
import { isIndexingIcons } from './ItemArt.jsx'
import { Icon } from './ui.jsx'

export function Settings({ gamePath, root, cli, bundledCli, log, store, report, busy, canApply, onChooseRoot, onScan,
  cacheStatus, onIndexIcons, onChooseCli, onDiagnose, onForceApply, onRestore, onRecover }) {
  const indexing = isIndexingIcons(cacheStatus)
  return <div className="settings-grid view-entry">
    <section className="panel setting">
      <h2>Instalação do Dota 2</h2>
      <p className="path">{gamePath || 'Pasta do Dota 2 não selecionada'}</p>
      <div className="setting-actions">
        <button type="button" disabled={busy} onClick={onChooseRoot}>Selecionar pasta</button>
        {root && <button type="button" disabled={busy} onClick={onScan}>Reler catálogo</button>}
      </div>
    </section>
    <section className="panel setting">
      <h2>Ícones dos itens</h2>
      <p className="muted">Os ícones já acompanham o aplicativo. Texturas novas são convertidas sob demanda pelo CLI embutido.</p>
      <p className="path">{cli ? (bundledCli ? 'CLI embutido detectado automaticamente' : cli) : 'CLI não encontrado (somente ícones embutidos e cache)'}</p>
      <details className="advanced">
        <summary>Opções avançadas</summary>
        <button type="button" disabled={busy} onClick={onChooseCli}>Selecionar Decompiler.exe ou Source2Viewer-CLI.exe</button>
        <button type="button" disabled={!root || !cli || busy || indexing} onClick={onIndexIcons}>Preparar cache de ícones</button>
      </details>
      <p role="status">Cache {cacheStatus.phase}{cacheStatus.total ? ` · ${cacheStatus.done}/${cacheStatus.total}` : ''} {cacheStatus.message}</p>
    </section>
    <section className="panel setting wide-setting">
      <div className="section-bar">
        <h2>Diagnóstico da instalação</h2>
        <button type="button" disabled={busy || !root} onClick={onDiagnose}>Verificar arquivos agora</button>
      </div>
      {report && <div role="status" className="diagnostic">
        <small>{new Date(report.time).toLocaleString('pt-BR')}</small>
        {typeof report.gameInfoChanged === 'boolean' && <p>{report.gameInfoChanged ? 'gameinfo.gi foi atualizado nesta aplicação.' : 'As montagens já estavam na posição configurada.'}</p>}
        {report.checks.map(check => <div className="check-result" key={check.label} data-ok={check.ok}>
          <Icon name={check.ok ? 'check' : 'close'}/>
          <div><strong>{check.label}</strong><p>{check.detail}</p></div>
        </div>)}
        {report.code === 'CUSTOM_DIR_CONTENTS' && <div className="diagnostic-action">
          <p>A pasta atual será movida para um backup ao lado de dota_custom.</p>
          <button type="button" className="primary" disabled={!canApply} onClick={onForceApply}>Limpar pasta dota_custom e aplicar</button>
        </div>}
        {report.preserved && <p>Pasta anterior preservada em {report.preserved}</p>}
        {report.client && <div><strong>Console do Dota 2</strong><p>{report.client}</p></div>}
      </div>}
      {log && <p className="path">{log}</p>}
    </section>
    <section className="panel setting">
      <h2>Restaurar jogo</h2>
      <button type="button" disabled={busy || !root} onClick={onRestore}>Restaurar gameinfo.gi e limpar mods</button>
    </section>
    <section className="panel setting">
      <h2>Recuperação de inicialização</h2>
      <p className="muted">Se gameinfo.gi estiver ausente ou ilegível, recupere o primeiro backup.</p>
      <button type="button" disabled={busy || !root} onClick={onRecover}>Recuperar gameinfo.gi do backup</button>
    </section>
    {store && <p className="path wide-setting data-path">{store}</p>}
  </div>
}
