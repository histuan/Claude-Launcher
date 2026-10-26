// Preload com sandbox precisa ser CommonJS. A API para a interface entra nas próximas fases.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('multiconta', {});
