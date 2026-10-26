// A sandboxed preload must be CommonJS (.cts compiles to preload.cjs). The API for the interface arrives in later phases.
import electron = require('electron');

electron.contextBridge.exposeInMainWorld('launcher', {});
