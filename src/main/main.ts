import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { existsSync, readdirSync } from 'node:fs';
import { appendFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ActionError, ActionResult, LauncherState, SignInStatus, SignInTarget } from '../core/api.js';
import {
  addAccount, afterSignIn, defaultConfig, isMain, removeAccount, renameAccount, setCookiePending, setGreetingName,
  type LauncherConfig,
} from '../core/config.js';
import { cleanDisplayName } from '../core/name.js';
import { launchUntilWindow } from '../core/launch.js';
import { pidsForProfile, pidsInsideFolder, runningAccountIds, windowPid } from '../core/processes.js';
import type { Marker, MarkerAccount } from '../core/signIn.js';
import { strings } from '../renderer/strings.js';
import { closeProfile, removeProfile, type AccountProcessDeps } from './accountActions.js';
import { ConfigStore } from './configStore.js';
import { SignedInTracker } from './signedIn.js';
import { SignInFlow, type StartError } from './signInFlow.js';
import {
  bringToFront, launchClaude, listClaudeProcesses, queryAllProcesses, queryClaudeProcesses, queryClaudeProcessList, queryClaudeWindows,
  resolveClaudeExe,
} from './system/claudeApp.js';
import {
  closeProcessesGracefully, describeProfileLookup, freeBytes, isProcessAlive, isSignedIn, killProcesses, markerFileFor,
  resolveDefaultProfile,
} from './system/claudeProfile.js';
import { hasSessionCookie } from './system/cookies.js';
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
/** Step timings of Add account / Sign in (paths and durations only, no secrets). Appended; restarted past 64 KB. */
const timingsLog = path.join(app.getPath('userData'), 'sign-in-timings.log');
const defaultName: Promise<string> = onWindows
  ? windowsDisplayName(process.env, runPowerShell)
  : Promise.resolve(cleanDisplayName('', process.env.USERNAME ?? process.env.USER));

let win: BrowserWindow | null = null;

/** "Not signed in": see signedIn.ts (cookie; keys only while cookiePending or when the cookie DB is unreadable). */
const signedInTracker = new SignedInTracker({
  sessionCookie: (dir) => hasSessionCookie(dir),
  configOauth: isSignedIn,
  cookieWritten: (id) => {
    store.update((c) => setCookiePending(c, id, false)).catch((err: unknown) =>
      console.warn(`Could not clear cookiePending: ${(err as Error).message}`));
  },
});

async function state(cfg: LauncherConfig): Promise<LauncherState> {
  return {
    defaultName: await defaultName,
    greetingName: cfg.greetingName,
    accounts: cfg.accounts,
    signedOut: await signedInTracker.signedOut(cfg.accounts, await runningIds()),
    signInAvailable: (await signInSlot) !== null,
    signInLog,
    timingsLog,
    signIn: signInStatus,
    version: app.getVersion(),
  };
}

async function result(cfg: LauncherConfig, error: ActionError | null = null): Promise<ActionResult> {
  return { state: await state(cfg), error };
}

async function runningIds(): Promise<string[]> {
  if (!onWindows) return [];
  return runningAccountIds(store.current.accounts, await listClaudeProcesses(runPowerShell));
}

const accountProcesses: AccountProcessDeps = {
  listProcesses: () => queryClaudeProcesses(runPowerShell),
  kill: (pids) => killProcesses(pids),
};

/**
 * Opens Claude for the account and closes the launcher once its window is visible (SCOPE §4.1). A fresh profile may
 * start in the tray only: launchUntilWindow spawns it once more. No window after ~8 s: the launcher stays open.
 */
async function openAccount(id: string): Promise<ActionResult> {
  const account = store.current.accounts.find((a) => a.id === id);
  if (!account) return result(store.current);
  const exe = onWindows ? await resolveClaudeExe(runPowerShell, process.env, existsSync) : null;
  if (!exe) return result(store.current, 'notInstalled');
  try {
    if (account.profileDir !== null) await createProfileDir(account.profileDir, userProfile);
    let pid: number | null = null;
    const shown = await launchUntilWindow({
      launch: () => launchClaude(exe, account.profileDir),
      hasWindow: async () => (pid = windowPid(await queryClaudeWindows(runPowerShell), account.profileDir)) !== null,
    });
    if (!shown || pid === null) return result(store.current, 'noWindow');
    // While the launcher is still the foreground app (it quits right after). Best effort.
    await bringToFront(runPowerShell, pid);
  } catch (err) {
    console.warn(`Could not open Claude: ${(err as Error).message}`);
    return result(store.current, 'launchFailed');
  }
  setTimeout(() => app.quit(), 0); // after the reply reaches the window
  return result(store.current);
}

/** "Close this account": ends only that profile's Claude processes. */
async function closeAccount(id: string): Promise<ActionResult> {
  const account = store.current.accounts.find((a) => a.id === id);
  if (!account || !onWindows) return result(store.current);
  // During a sign-in the default profile belongs to the sign-in flow (its Cancel closes it).
  if (flow?.active) return result(store.current, 'pending');
  try {
    if (!(await closeProfile(accountProcesses, account.profileDir))) return result(store.current, 'closeFailed');
  } catch (err) {
    console.warn(`Could not close the account: ${(err as Error).message}`);
    return result(store.current, 'closeFailed');
  }
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

/**
 * Sign-in window: waits (up to ~8 s) for the default Claude's window, then brings it to the front while the
 * launcher is still the foreground app. Best effort: errors only warn.
 */
async function focusDefaultClaude(): Promise<void> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const pid = windowPid(await queryClaudeWindows(runPowerShell).catch(() => []), null);
    if (pid !== null) {
      logTiming(`start: bring the sign-in window to the front: ${await bringToFront(runPowerShell, pid) ? 'done' : 'refused'}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** Timing lines are written in order, never block the flow, and a failed write only warns. */
let timingWork: Promise<void> = Promise.resolve();
function logTiming(line: string): void {
  const text = `${new Date().toISOString()}  ${line}\n`;
  console.log(`[sign-in] ${line}`);
  timingWork = timingWork
    .then(async () => {
      const size = await stat(timingsLog).then((s) => s.size, () => 0);
      await (size > 64 * 1024 ? writeFile(timingsLog, text, 'utf8') : appendFile(timingsLog, text, 'utf8'));
    })
    .catch((err: unknown) => console.warn(`Could not write ${timingsLog}: ${(err as Error).message}`));
}

async function onSignInStatus(status: SignInStatus): Promise<void> {
  const final = !['starting', 'waiting', 'saving', 'checking', 'notFound'].includes(status.phase);
  signInStatus = final ? null : status;
  if (final) lastSignInOutcome = status;
  if (status.phase === 'done') signedInTracker.forget(status.account.id);
  if (status.phase === 'done') {
    // Force-ended maybe before its cookie write: cookiePending until the cookie shows up, but only when the profile
    // got quiet first. An unsure save gets no flag, so the card says "Not signed in" unless the cookie is there.
    const { account } = status;
    await store.update((c) => afterSignIn(c, account, status.unsure !== true));
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
  // Only the default instance: extra accounts (own --user-data-dir) stay open during Add account.
  listDefaultPids: async () => pidsForProfile(await queryClaudeProcesses(runPowerShell), null),
  closeGracefully: (pids) => closeProcessesGracefully(pids),
  kill: (pids) => killProcesses(pids),
  isAlive: (pid) => isProcessAlive(pid),
  listPidsInside: async (dir) => pidsInsideFolder(await queryAllProcesses(runPowerShell), dir),
  launchDefault: openDefaultClaude,
  focusDefault: focusDefaultClaude,
  freeBytes,
  log: logTiming,
  onStatus: (status) => {
    statusWork = statusWork.then(() => onSignInStatus(status)).catch((err: unknown) =>
      console.warn(`Sign-in status: ${(err as Error).message}`));
  },
}) : null;
// Detection: the oauth key names in config.json, checked every ~1 s while a sign-in is open.
setInterval(() => { if (flow?.active) void flow.poll(); }, 1000);

const START_ERRORS: Record<StartError, ActionError> = {
  pending: 'pending', defaultRunning: 'defaultRunning', reopened: 'reopened', profileInUse: 'profileInUse', disk: 'disk', folder: 'folder',
  launchFailed: 'launchFailed',
};

async function startSignIn(target: SignInTarget): Promise<ActionResult> {
  if (!flow) return result(store.current, 'noProfile');
  if (flow.active) return result(store.current, 'pending');
  const t0 = Date.now();
  logTiming(`--- ${'label' in target ? 'Add account' : 'Sign in'}`);
  // Looked up again now: the running Claude is the most reliable source. Both PowerShell queries run in parallel.
  signInSlot = lookUpDefaultProfile();
  const [slot, exe] = await Promise.all([signInSlot, resolveClaudeExe(runPowerShell, process.env, existsSync)]);
  logTiming(`start: find the main profile and Claude.exe: ${Date.now() - t0} ms`);
  if (!slot) return result(store.current, 'noProfile');
  if (!exe) return result(store.current, 'notInstalled');

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
  let error: ActionError | null;
  try {
    const startError = await flow.start(slot, account);
    error = startError ? START_ERRORS[startError] : null;
  } catch (err) {
    // E.g. the process query failed: we cannot prove the default Claude is closed, so nothing was touched.
    console.warn(`Sign-in not started: ${(err as Error).message}`);
    error = 'defaultRunning';
  }
  // The step statuses reach the window before this reply; a failed start leaves no "starting" status behind.
  await statusWork;
  if (error) {
    signInStatus = null;
    logTiming(`start: stopped (${error}): ${Date.now() - t0} ms`);
  }
  return result(store.current, error);
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

/**
 * Deletes the profile folder, then the card. A running account (its folder is locked) is refused, unless the person
 * chose "Close and remove": then only that account's Claude is closed first.
 */
async function removeExisting(id: string, closeFirst: boolean): Promise<ActionResult> {
  const account = store.current.accounts.find((a) => a.id === id);
  if (!account || isMain(account) || account.profileDir === null) return result(store.current);
  const dir = account.profileDir;
  let error: ActionError | null;
  try {
    error = await removeProfile({
      ...accountProcesses,
      // Off Windows there is no Claude to look for.
      listProcesses: onWindows ? accountProcesses.listProcesses : async () => [],
      deleteDir: (d) => deleteProfileDir(d, userProfile),
    }, dir, closeFirst);
  } catch (err) {
    console.warn(`Could not check the account's processes: ${(err as Error).message}`);
    error = 'closeFailed';
  }
  if (error) return result(store.current, error);
  signedInTracker.forget(id);
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
  ipcMain.handle('launcher:closeAccount', (_e, id: unknown) => {
    if (!isText(id)) throw new Error('Invalid arguments');
    return closeAccount(id);
  });
  ipcMain.handle('launcher:removeAccount', (_e, id: unknown, closeFirst: unknown) => {
    if (!isText(id)) throw new Error('Invalid arguments');
    return removeExisting(id, closeFirst === true);
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
