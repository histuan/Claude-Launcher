import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ActionError, ActionResult, LauncherState } from '../core/api.js';
import {
  addAccount, defaultConfig, isMain, removeAccount, renameAccount, setGreetingName, type LauncherConfig,
} from '../core/config.js';
import { cleanDisplayName } from '../core/name.js';
import { runningAccountIds } from '../core/processes.js';
import { strings } from '../renderer/strings.js';
import { ConfigStore } from './configStore.js';
import { launchClaude, listClaudeProcesses, resolveClaudeExe } from './system/claudeApp.js';
import { createProfileDir, deleteProfileDir } from './system/profileFolders.js';
import { runPowerShell, windowsDisplayName } from './system/windowsUser.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Window chrome colours: keep in sync with --bg and --text in src/renderer/styles.css.
const BG = '#262624';
const TEXT = '#F5F4EE';

const userProfile = process.env.USERPROFILE ?? os.homedir();
const onWindows = process.platform === 'win32';
const store = new ConfigStore(path.join(app.getPath('userData'), 'config.json'));
const defaultName: Promise<string> = onWindows
  ? windowsDisplayName(process.env, runPowerShell)
  : Promise.resolve(cleanDisplayName('', process.env.USERNAME ?? process.env.USER));

async function state(cfg: LauncherConfig): Promise<LauncherState> {
  return { defaultName: await defaultName, greetingName: cfg.greetingName, accounts: cfg.accounts };
}

async function result(cfg: LauncherConfig, error: ActionError | null = null): Promise<ActionResult> {
  return { state: await state(cfg), error };
}

async function runningIds(): Promise<string[]> {
  if (!onWindows) return [];
  return runningAccountIds(store.current.accounts, await listClaudeProcesses(runPowerShell));
}

/** Opens Claude for the account, then closes the launcher (SCOPE §4.1). */
async function openAccount(id: string): Promise<ActionResult> {
  const account = store.current.accounts.find((a) => a.id === id);
  if (!account) return result(store.current);
  const exe = onWindows ? await resolveClaudeExe(runPowerShell, process.env, existsSync) : null;
  if (!exe) return result(store.current, 'notInstalled');
  try {
    if (account.profileDir !== null) await createProfileDir(account.profileDir, userProfile);
    await launchClaude(exe, account.profileDir);
  } catch (err) {
    console.warn(`Could not open Claude: ${(err as Error).message}`);
    return result(store.current, 'launchFailed');
  }
  setTimeout(() => app.quit(), 0); // after the reply reaches the window
  return result(store.current);
}

/** Phase 3 (temporary until Phase 4): creates the card and its profile folder, no sign-in yet. */
async function addNewAccount(label: string): Promise<ActionResult> {
  const added = addAccount(store.current, label, userProfile, existsSync);
  if (!added || added.account.profileDir === null) return result(store.current);
  try {
    await createProfileDir(added.account.profileDir, userProfile);
  } catch (err) {
    console.warn(`Could not create the profile folder: ${(err as Error).message}`);
    return result(store.current, 'folder');
  }
  const { account } = added;
  return result(await store.update((c) =>
    (c.accounts.some((a) => a.id === account.id) ? c : { ...c, accounts: [...c.accounts, account] })));
}

/** Deletes the profile folder, then the card. Refused while that account's Claude is open (the folder is locked). */
async function removeExisting(id: string): Promise<ActionResult> {
  const account = store.current.accounts.find((a) => a.id === id);
  if (!account || isMain(account) || account.profileDir === null) return result(store.current);
  if ((await runningIds()).includes(id)) return result(store.current, 'running');
  try {
    await deleteProfileDir(account.profileDir, userProfile);
  } catch (err) {
    console.warn(`Could not delete the profile folder: ${(err as Error).message}`);
    return result(store.current, 'folder');
  }
  return result(await store.update((c) => removeAccount(c, id)));
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
  ipcMain.handle('launcher:openAccount', (_e, id: unknown) => {
    if (!isText(id)) throw new Error('Invalid arguments');
    return openAccount(id);
  });
  ipcMain.handle('launcher:addAccount', (_e, label: unknown) => {
    if (!isText(label)) throw new Error('Invalid arguments');
    return addNewAccount(label);
  });
  ipcMain.handle('launcher:removeAccount', (_e, id: unknown) => {
    if (!isText(id)) throw new Error('Invalid arguments');
    return removeExisting(id);
  });
  ipcMain.handle('launcher:runningAccounts', () => runningIds());
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
  // First run: only Main. Phase 2 sample accounts (demo-*) are dropped by parseConfig.
  await store.load(defaultConfig);
  registerIpc();
  createWindow();
}

start().catch((err: unknown) => {
  dialog.showErrorBox(strings.appName, err instanceof Error ? err.message : String(err));
  app.quit();
});
app.on('window-all-closed', () => app.quit());
