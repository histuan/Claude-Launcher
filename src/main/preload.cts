// A sandboxed preload must be CommonJS (.cts compiles to preload.cjs). Shape: LauncherApi in src/core/api.ts.
import electron = require('electron');

const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld('launcher', {
  getState: () => ipcRenderer.invoke('launcher:getState'),
  setGreetingName: (name: string | null) => ipcRenderer.invoke('launcher:setGreetingName', name),
  renameAccount: (id: string, label: string) => ipcRenderer.invoke('launcher:renameAccount', id, label),
  setDetails: (id: string, email: string, realName: string) => ipcRenderer.invoke('launcher:setDetails', id, email, realName),
  setPhoto: (id: string, dataUrl: string | null) => ipcRenderer.invoke('launcher:setPhoto', id, dataUrl),
  openAccount: (id: string) => ipcRenderer.invoke('launcher:openAccount', id),
  startSignIn: (target: unknown) => ipcRenderer.invoke('launcher:startSignIn', target),
  confirmSignIn: () => ipcRenderer.invoke('launcher:confirmSignIn'),
  cancelSignIn: () => ipcRenderer.invoke('launcher:cancelSignIn'),
  waitLongerSignIn: () => ipcRenderer.invoke('launcher:waitLongerSignIn'),
  onSignIn: (listener: (status: unknown) => void) => {
    ipcRenderer.on('launcher:signIn', (_e, status: unknown) => listener(status));
  },
  onCardsChanged: (listener: () => void) => {
    ipcRenderer.on('launcher:cardsChanged', () => listener());
  },
  closeAccount: (id: string) => ipcRenderer.invoke('launcher:closeAccount', id),
  removeAccount: (id: string, closeFirst?: boolean) => ipcRenderer.invoke('launcher:removeAccount', id, closeFirst === true),
  runningAccounts: () => ipcRenderer.invoke('launcher:runningAccounts'),
  cardsShown: () => ipcRenderer.invoke('launcher:cardsShown'),
  updates: {
    onStatus: (listener: (status: unknown) => void) => {
      ipcRenderer.on('launcher:update', (_e, status: unknown) => listener(status));
    },
    later: () => ipcRenderer.invoke('launcher:update:later'),
    install: () => ipcRenderer.invoke('launcher:update:install'),
    openNotes: () => ipcRenderer.invoke('launcher:update:openNotes'),
    openReleases: () => ipcRenderer.invoke('launcher:update:openReleases'),
  },
  memories: {
    begin: (sourceId: string, targetId: string) => ipcRenderer.invoke('launcher:memories:begin', sourceId, targetId),
    proceed: () => ipcRenderer.invoke('launcher:memories:proceed'),
    useParts: (parts: string[]) => ipcRenderer.invoke('launcher:memories:useParts', parts),
    copyPart: (index: number) => ipcRenderer.invoke('launcher:memories:copyPart', index),
    finish: () => ipcRenderer.invoke('launcher:memories:finish'),
    cancel: () => ipcRenderer.invoke('launcher:memories:cancel'),
  },
});
