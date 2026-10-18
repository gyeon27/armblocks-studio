const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('robotAPI', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (value) => ipcRenderer.invoke('settings:save', value),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (value) => ipcRenderer.invoke('project:save', value),
  chooseCli: () => ipcRenderer.invoke('cli:choose'),
  checkCli: () => ipcRenderer.invoke('cli:check'),
  listPorts: () => ipcRenderer.invoke('ports:list'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  startUninstall: (options) => ipcRenderer.invoke('uninstall:start', options),
  onUninstallProgress: (callback) => ipcRenderer.on('uninstall:progress', (_event, value) => callback(value)),
  build: (payload) => ipcRenderer.invoke('sketch:build', payload),
  upload: (payload) => ipcRenderer.invoke('sketch:upload', payload),
  serialConnect: (port) => ipcRenderer.invoke('serial:connect', port),
  serialWrite: (value) => ipcRenderer.invoke('serial:write', value),
  serialDisconnect: () => ipcRenderer.invoke('serial:disconnect'),
  onBuildLog: (callback) => ipcRenderer.on('build:log', (_event, value) => callback(value)),
  onSerialData: (callback) => ipcRenderer.on('serial:data', (_event, value) => callback(value)),
  onSerialClosed: (callback) => ipcRenderer.on('serial:closed', (_event, value) => callback(value))
});
