import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { existsSync, readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ActionError, ActionResult, LauncherState, SignInStatus, SignInTarget } from '../core/api.js';
import {
  addAccount, defaultConfig, isMain, removeAccount, renameAccount, setGreetingName, type LauncherConfig,
} from '../core/config.js';
import { cleanDisplayName } from '../core/name.js';
import { pidsInsideFolder, runningAccountIds } from '../core/processes.js';
import type { Marker, MarkerAccount } from '../core/signIn.js';
import { strings } from '../renderer/strings.js';
import { ConfigStore } from './configStore.js';
import { SignInFlow, type StartError } from './signInFlow.js';
import {
  launchClaude, listClaudeProcesses, queryAllProcesses, queryClaudeProcesses, queryClaudeProcessList, resolveClaudeExe,
} from './system/claudeApp.js';
import {
  describeProfileLookup, freeBytes, isSignedIn, killProcesses, markerFileFor, resolveDefaultProfile,
} from './system/claudeProfile.js';
import { createProfileDir, deleteProfileDir } from './system/profileFolders.js';
import { runPowerShell, windowsDisplayName } from './system/windowsUser.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Window chrome colours: keep in sync with --bg and --text in src/renderer/styles.css.
const BG = '#262624';
const TEXT = '#F5F4EE';

const userProfile = process.env.USERPROFILE ?? os.homedir();
const onWindows = process.platform === 'win32';
const store = new ConfigStore(path.join(app.getPath('userData'), 'config.json'));
const signInLog = path.join(app.getPath('userData'), 'sign-in-check.log');
const defaultName: Promise<string> = onWindows
  ? windowsDisplayName(process.env, runPowerShell)
  : Promise.resolve(cleanDisplayName('', process.env.USERNAME ?? process.env.USER));

let win: BrowserWindow | null = null;

async function state(cfg: LauncherConfig): Promise<LauncherState> {
  const extra = cfg.accounts.filter((a) => a.profileDir !== null);
  const signedIn = await Promise.all(extra.map((a) => isSignedIn(a.profileDir as string)));
  return {
    defaultName: await defaultName,
    greetingName: cfg.greetingName,
    accounts: cfg.accounts,
    signedOut: extra.filter((_a, i) => !signedIn[i]).map((a) => a.id),
    signInAvailable: (await signInSlot) !== null,
    signInLog,
    signIn: signInStatus,
  };
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

// ---------- Sign-in by snapshot (WINDOWS.md §4) ----------

/** Live status while a sign-in runs; null otherwise. */
let signInStatus: SignInStatus | null = null;
let lastSignInOutcome: SignInStatus | null = null;
/** Status handling runs in order; startup waits for it so a recovered card is saved before the window opens. */
let statusWork: Promise<void> = Promise.resolve();

async function openDefaultClaude(): Promise<void> {
  const exe = await resolveClaudeExe(runPowerShell, process.env, existsSync);
  if (!exe) throw new Error('Claude is not installed');
  await launchClaude(exe, null);
}

async function onSignInStatus(status: SignInStatus): Promise<void> {
  const final = !['waiting', 'detected', 'saving'].includes(status.phase);
  signInStatus = final ? null : status;
  if (final) lastSignInOutcome = status;
  if (status.phase === 'done' && status.account.isNew) {
    const { id, label, profileDir } = status.account;
    await store.update((c) => (c.accounts.some((a) => a.id === id) ? c
      : { ...c, accounts: [...c.accounts, { id, label, email: null, realName: null, photo: null, profileDir }] }));
  }
  win?.webContents.send('launcher:signIn', status);
}

/**
 * Finds the default profile (see resolveDefaultProfile) and writes the folders checked to sign-in-check.log.
 * null = not found with confidence: sign-in stays off, opening accounts keeps working.
 */
async function lookUpDefaultProfile(): Promise<string | null> {
  if (!onWindows) return null;
  const found = await resolveDefaultProfile({
    run: runPowerShell,
    env: process.env,
    listClaudeProcesses: () => queryClaudeProcessList(runPowerShell),
    exists: existsSync,
    listDir: (dir) => readdirSync(dir),
  });
  const report = describeProfileLookup(found, new Date());
  if (!found.slot) console.warn(report);
  await writeFile(signInLog, report, 'utf8').catch((err: unknown) =>
    console.warn(`Could not write ${signInLog}: ${(err as Error).message}`));
  return found.slot;
}

/** Last lookup result (the startup one until a sign-in starts). */
let signInSlot: Promise<string | null> = Promise.resolve(null);

const markerFile = markerFileFor(process.env);
const flow = onWindows && markerFile ? new SignInFlow({
  userProfile,
  markerFile,
  listDefaultPids: async () =>
    (await queryClaudeProcesses(runPowerShell)).filter((p) => p.profileDir === null).map((p) => p.pid),
  kill: (pids) => killProcesses(pids),
  listPidsInside: async (dir) => pidsInsideFolder(await queryAllProcesses(runPowerShell), dir),
  launchDefault: openDefaultClaude,
  freeBytes,
  onStatus: (status) => {
    statusWork = statusWork.then(() => onSignInStatus(status)).catch((err: unknown) =>
      console.warn(`Sign-in status: ${(err as Error).message}`));
  },
}) : null;
setInterval(() => { if (flow?.active) void flow.poll(); }, 500);

const START_ERRORS: Record<StartError, ActionError> = {
  pending: 'pending', defaultRunning: 'defaultRunning', profileInUse: 'profileInUse', disk: 'disk', folder: 'folder',
  launchFailed: 'launchFailed',
};

async function startSignIn(target: SignInTarget): Promise<ActionResult> {
  if (!flow) return result(store.current, 'noProfile');
  if (flow.active) return result(store.current, 'pending');
  // Looked up again now: the running Claude is the most reliable source.
  signInSlot = lookUpDefaultProfile();
  const slot = await signInSlot;
  if (!slot) return result(store.current, 'noProfile');
  if (!(await resolveClaudeExe(runPowerShell, process.env, existsSync))) return result(store.current, 'notInstalled');

  let account: MarkerAccount;
  if ('label' in target) {
    const added = addAccount(store.current, target.label, userProfile, existsSync);
    if (!added?.account.profileDir || !added.account.label) return result(store.current);
    account = { id: added.account.id, label: added.account.label, profileDir: added.account.profileDir, isNew: true };
  } else {
    const card = store.current.accounts.find((a) => a.id === target.accountId);
    if (!card || card.profileDir === null) return result(store.current);
    if ((await runningIds()).includes(card.id)) return result(store.current, 'running');
    account = { id: card.id, label: card.label ?? card.id, profileDir: card.profileDir, isNew: false };
  }
  try {
    const error = await flow.start(slot, account);
    return result(store.current, error ? START_ERRORS[error] : null);
  } catch (err) {
    // E.g. the process query failed: we cannot prove the default Claude is closed, so nothing was touched.
    console.warn(`Sign-in not started: ${(err as Error).message}`);
    return result(store.current, 'defaultRunning');
  }
}

/** Runs before the window and before anything touches Claude: finishes or undoes an interrupted sign-in. */
async function recoverSignIn(marker: Marker): Promise<void> {
  if (!flow) return;
  let choice: 'restore' | 'continue' = 'restore';
  if (marker.state === 'signing-in') {
    const answer = await dialog.showMessageBox({
      type: 'warning',
      title: strings.appName,
      message: strings.recovery.title,
      detail: strings.recovery.body(marker.account.label),
      buttons: [strings.recovery.restore, strings.recovery.continue],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (answer.response === 1) choice = 'continue';
  }
  try {
    await flow.recover(marker, choice);
  } catch (err) {
    console.warn(`Recovery failed: ${(err as Error).message}`);
    lastSignInOutcome = { phase: 'failed', stashPath: marker.stashed ? marker.stash : null };
  }
  await statusWork;
  if (lastSignInOutcome?.phase === 'failed') {
    dialog.showErrorBox(strings.signIn.failed.title, strings.signIn.failed.body(lastSignInOutcome.stashPath));
  }
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
  ipcMain.handle('launcher:startSignIn', (_e, target: unknown) => {
    const t = (typeof target === 'object' && target !== null ? target : {}) as Record<string, unknown>;
    if (isText(t.label)) return startSignIn({ label: t.label });
    if (isText(t.accountId)) return startSignIn({ accountId: t.accountId });
    throw new Error('Invalid arguments');
  });
  ipcMain.handle('launcher:confirmSignIn', () => flow?.confirm());
  ipcMain.handle('launcher:cancelSignIn', () => flow?.cancel());
  ipcMain.handle('launcher:removeAccount', (_e, id: unknown) => {
    if (!isText(id)) throw new Error('Invalid arguments');
    return removeExisting(id);
  });
  ipcMain.handle('launcher:runningAccounts', () => runningIds());
}

function createWindow(): void {
  win = new BrowserWindow({
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
  const w = win;
  w.once('ready-to-show', () => w.show());
  // Closing the launcher in the middle of a sign-in cancels it cleanly (a crash is handled on the next start).
  w.on('close', (e) => {
    if (!flow?.active) return;
    e.preventDefault();
    void flow.cancel().finally(() => w.destroy());
  });
  w.on('closed', () => { win = null; });
  w.loadFile(path.join(here, '..', 'renderer', 'index.html'));
}

async function start(): Promise<void> {
  await app.whenReady();
  // Before anything else: an interrupted sign-in leaves a marker (WINDOWS.md §4).
  const marker = flow ? await flow.pending() : null;
  // First run: only Main. Phase 2 sample accounts (demo-*) are dropped by parseConfig.
  await store.load(defaultConfig);
  if (marker) await recoverSignIn(marker);
  signInSlot = lookUpDefaultProfile(); // after the recovery, which may put the main profile back
  registerIpc();
  createWindow();
}

start().catch((err: unknown) => {
  dialog.showErrorBox(strings.appName, err instanceof Error ? err.message : String(err));
  app.quit();
});
app.on('window-all-closed', () => app.quit());
