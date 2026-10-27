// A sandboxed preload must be CommonJS (.cts compiles to preload.cjs). Shape: LauncherApi in src/core/api.ts.
import electron = require('electron');

const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld('launcher', {
  getState: () => ipcRenderer.invoke('launcher:getState'),
  setGreetingName: (name: string | null) => ipcRenderer.invoke('launcher:setGreetingName', name),
  renameAccount: (id: string, label: string) => ipcRenderer.invoke('launcher:renameAccount', id, label),
  openAccount: (id: string) => ipcRenderer.invoke('launcher:openAccount', id),
  startSignIn: (target: unknown) => ipcRenderer.invoke('launcher:startSignIn', target),
  confirmSignIn: () => ipcRenderer.invoke('launcher:confirmSignIn'),
  cancelSignIn: () => ipcRenderer.invoke('launcher:cancelSignIn'),
  onSignIn: (listener: (status: unknown) => void) => {
    ipcRenderer.on('launcher:signIn', (_e, status: unknown) => listener(status));
  },
  closeAccount: (id: string) => ipcRenderer.invoke('launcher:closeAccount', id),
  removeAccount: (id: string, closeFirst?: boolean) => ipcRenderer.invoke('launcher:removeAccount', id, closeFirst === true),
  runningAccounts: () => ipcRenderer.invoke('launcher:runningAccounts'),
});
