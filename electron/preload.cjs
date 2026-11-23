const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('arsenal', { ...Object.fromEntries(
  ['init', 'choose', 'scan', 'apply', 'restore', 'recover', 'diagnose', 'savePreset', 'importPack', 'exportPack',
    'chooseCli', 'cachedIcons', 'icons', 'indexIcons', 'cacheStatus', 'equipSet', 'play', 'audioPreview', 'audioTrack', 'tauntPreview'].map(name => [name, (...args) => ipcRenderer.invoke(name, ...args)])
), onIconProgress(callback) {
  const listener = (_event, progress) => callback(progress)
  ipcRenderer.on('iconProgress', listener)
  return () => ipcRenderer.removeListener('iconProgress', listener)
} })
