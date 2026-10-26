// A sandboxed preload must be CommonJS (.cts compiles to preload.cjs). Shape: LauncherApi in src/core/api.ts.
import electron = require('electron');

const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld('launcher', {
  getState: () => ipcRenderer.invoke('launcher:getState'),
  setGreetingName: (name: string | null) => ipcRenderer.invoke('launcher:setGreetingName', name),
  renameAccount: (id: string, label: string) => ipcRenderer.invoke('launcher:renameAccount', id, label),
  openAccount: (id: string) => ipcRenderer.invoke('launcher:openAccount', id),
  addAccount: (label: string) => ipcRenderer.invoke('launcher:addAccount', label),
  removeAccount: (id: string) => ipcRenderer.invoke('launcher:removeAccount', id),
  runningAccounts: () => ipcRenderer.invoke('launcher:runningAccounts'),
});
