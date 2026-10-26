// A sandboxed preload must be CommonJS. The API for the interface arrives in later phases.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('launcher', {});
