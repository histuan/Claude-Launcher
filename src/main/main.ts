import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LauncherState } from '../core/api.js';
import { demoConfig, removeAccount, renameAccount, setGreetingName, type LauncherConfig } from '../core/config.js';
import { cleanDisplayName } from '../core/name.js';
import { strings } from '../renderer/strings.js';
import { ConfigStore } from './configStore.js';
import { runPowerShell, windowsDisplayName } from './system/windowsUser.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Window chrome colours: keep in sync with --bg and --text in src/renderer/styles.css.
const BG = '#262624';
const TEXT = '#F5F4EE';

const store = new ConfigStore(path.join(app.getPath('userData'), 'config.json'));
const defaultName: Promise<string> = process.platform === 'win32'
  ? windowsDisplayName(process.env, runPowerShell)
  : Promise.resolve(cleanDisplayName('', process.env.USERNAME ?? process.env.USER));

async function state(cfg: LauncherConfig): Promise<LauncherState> {
  return { defaultName: await defaultName, greetingName: cfg.greetingName, accounts: cfg.accounts };
}

const isText = (value: unknown): value is string => typeof value === 'string';

function registerIpc(): void {
  ipcMain.handle('launcher:getState', () => state(store.current));
  ipcMain.handle('launcher:setGreetingName', async (_e, name: unknown) =>
    state(await store.update((c) => setGreetingName(c, isText(name) ? name : null))));
  ipcMain.handle('launcher:renameAccount', async (_e, id: unknown, label: unknown) => {
    if (!isText(id) || !isText(label)) throw new Error('Invalid arguments');
    return state(await store.update((c) => renameAccount(c, id, label)));
  });
  ipcMain.handle('launcher:removeAccount', async (_e, id: unknown) => {
    if (!isText(id)) throw new Error('Invalid arguments');
    return state(await store.update((c) => removeAccount(c, id)));
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: BG,
    title: strings.appName,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: BG, symbolColor: TEXT, height: 36 },
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(here, '..', 'renderer', 'index.html'));
}

async function start(): Promise<void> {
  await app.whenReady();
  // Phase 2: the first run seeds sample accounts so the screen can be tried (ids start with "demo-").
  await store.load(() => demoConfig(process.env.USERPROFILE ?? os.homedir()));
  registerIpc();
  createWindow();
}

start().catch((err: unknown) => {
  dialog.showErrorBox(strings.appName, err instanceof Error ? err.message : String(err));
  app.quit();
});
app.on('window-all-closed', () => app.quit());
