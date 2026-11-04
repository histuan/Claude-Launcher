import { app, BrowserWindow, clipboard, dialog, ipcMain } from 'electron';
import { existsSync, readdirSync } from 'node:fs';
import { appendFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ActionError, ActionResult, LauncherState, SignInStatus, SignInTarget } from '../core/api.js';
import {
  addAccount, afterSignIn, defaultConfig, isMain, removeAccount, renameAccount, setClaudeApp, setDetails, setGreetingName, setPhoto, setSignedIn,
  setStartupCache,
  type LauncherConfig,
} from '../core/config.js';
import { CachedLookup } from '../core/cachedLookup.js';
import { findClaudeApp, lookupError, type ClaudeLookup } from '../core/claudeApp.js';
import { checkDetails } from '../core/details.js';
import { cleanDisplayName } from '../core/name.js';
import { launchUntilWindow } from '../core/launch.js';
import { memorySources } from '../core/memories.js';
import { pidsForProfile, pidsInsideFolder, runningAccountIds, windowPid } from '../core/processes.js';
import { claudeVersion, type Marker, type MarkerAccount } from '../core/signIn.js';
import { strings } from '../renderer/strings.js';
import { closeProfile, removeProfile, type AccountProcessDeps } from './accountActions.js';
import { ConfigStore } from './configStore.js';
import { MemoryTransfer } from './memoryTransfer.js';
import { deletePhoto, readPhoto, savePhoto } from './photos.js';
import { SignedInTracker } from './signedIn.js';
import { SignInFlow, type StartError } from './signInFlow.js';
import {
  bringToFront, launchClaude, listClaudeProcesses, queryAllProcesses, queryClaudeProcesses, queryClaudeProcessList, queryClaudeWindows,
  lookUpClaudeApp,
} from './system/claudeApp.js';
import {
  closeProcessesGracefully, describeProfileLookup, freeBytes, isProcessAlive, killProcesses, markerFileFor,
  resolveDefaultProfile,
} from './system/claudeProfile.js';
import { readSessionCookie } from './system/cookies.js';
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
/** Card photos: userData/photos/<id>.png, kept in memory as data URLs for the window. */
const photosDir = path.join(app.getPath('userData'), 'photos');
const photos = new Map<string, string>();
/**
 * Windows display name and main Claude profile (both PowerShell, ~0.5 s together): the last values are kept in the
 * config, so the first screen does not wait for them; they are looked up again once the cards are shown (0.5.1).
 * Set in start(), after the config is loaded.
 */
let windowsName: CachedLookup<string>;
let mainProfile: CachedLookup<string | null>;
const cardsChanged = (): void => win?.webContents.send('launcher:cardsChanged');

let win: BrowserWindow | null = null;

/**
 * "Not signed in": only a valid sessionKey cookie decides (never the config.json keys). Running accounts are not read
 * (their cookie database is locked); a closed one is retried for ~10 s while still locked. Each final decision goes
 * to sign-in-timings.log ("card check <id>: cookie not found"), never cookie data. The cards show the last known
 * state (saved in the config) at once; the reads start only after the cards are on screen and run in the background.
 */
const signedInTracker = new SignedInTracker({
  sessionCookie: (dir) => readSessionCookie(dir),
  log: (line) => logTiming(line),
  onChange: cardsChanged,
  save: (id, signedIn) => {
    store.update((c) => setSignedIn(c, id, signedIn)).catch((err: unknown) =>
      console.warn(`Could not save the signed-in state: ${(err as Error).message}`));
  },
});
/** Cookie checks wait for the first cards on screen (startup), then run after every state. */
let cardsShown = false;
/** Last result of the process query (the renderer polls it every ~3 s). */
let lastRunning: string[] = [];

/** Startup timings (ms since the process started), logged once when the cards are on screen. */
const startup = { ready: 0, config: 0, window: 0, firstState: 0, name: 0, profile: 0 };

async function state(cfg: LauncherConfig): Promise<LauncherState> {
  const first = startup.firstState === 0;
  const t0 = performance.now();
  const name = await windowsName.get();
  const t1 = performance.now();
  const signInAvailable = (await mainProfile.get()) !== null;
  if (first) Object.assign(startup, { name: t1 - t0, profile: performance.now() - t1, firstState: performance.now() });
  if (cardsShown) signedInTracker.check(cfg.accounts, lastRunning);
  return {
    defaultName: name,
    greetingName: cfg.greetingName,
    accounts: cfg.accounts,
    photos: Object.fromEntries(cfg.accounts.flatMap((a) => {
      const url = a.photo ? photos.get(a.id) : undefined;
      return url ? [[a.id, url]] : [];
    })),
    ...signedInTracker.cards(cfg.accounts, lastRunning),
    signInAvailable,
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
  lastRunning = runningAccountIds(store.current.accounts, await listClaudeProcesses(runPowerShell));
  return lastRunning;
}

/** The renderer drew the first cards: log the startup time, then start the cookie checks (in the background). */
async function onCardsShown(): Promise<void> {
  if (cardsShown) return;
  cardsShown = true;
  const ms = (n: number): string => `${Math.round(n)} ms`;
  logTiming(`startup: cards shown: ${ms(performance.now())} after the launcher started (app ready ${ms(startup.ready)}, `
    + `config ${ms(startup.config)}, window ${ms(startup.window)}, first state ${ms(startup.firstState)}: `
    + `waited for the Windows name ${ms(startup.name)}, for the profile lookup ${ms(startup.profile)})`);
  const t0 = performance.now();
  const running = await runningIds();
  logTiming(`startup: process query: ${ms(performance.now() - t0)}`);
  signedInTracker.check(store.current.accounts, running);
  const t1 = performance.now();
  const [name, profile] = await Promise.all([windowsName.refresh(), mainProfile.refresh()]);
  if (name || profile) {
    logTiming(`startup: background refresh of the cached ${[name && 'Windows name', profile && 'main profile'].filter(Boolean).join(' and ')}: `
      + `${ms(performance.now() - t1)}`);
  }
}

const accountProcesses: AccountProcessDeps = {
  listProcesses: () => queryClaudeProcesses(runPowerShell),
  kill: (pids) => killProcesses(pids),
};

/**
 * Claude.exe: the cached path while the file exists (no PowerShell), else Get-AppxPackage (~15 s, one retry); a new
 * result is saved in the launcher config. A lookup that did not complete is never reported as "not installed".
 */
async function findClaude(): Promise<ClaudeLookup> {
  if (!onWindows) return { state: 'notInstalled' };
  const t0 = Date.now();
  const found = await findClaudeApp({
    cached: store.current.claudeApp,
    exists: existsSync,
    lookUp: () => lookUpClaudeApp(runPowerShell, process.env, existsSync),
    save: async (app) => { await store.update((c) => setClaudeApp(c, app)); },
  });
  const how = found.state === 'found' ? found.source : found.state === 'failed' ? `failed (${found.reason})` : 'not installed';
  if (!(found.state === 'found' && found.source === 'cache')) logTiming(`find Claude.exe: ${how}: ${Date.now() - t0} ms`);
  return found;
}

/**
 * Opens Claude for the account and closes the launcher once its window is visible (SCOPE §4.1). A fresh profile may
 * start without a window: launchUntilWindow spawns it once more. No window after ~8 s: the launcher stays open.
 */
async function openAccount(id: string, quitAfter = true): Promise<ActionResult> {
  const account = store.current.accounts.find((a) => a.id === id);
  if (!account) return result(store.current);
  const claude = await findClaude();
  if (claude.state !== 'found') return result(store.current, lookupError(claude));
  const { exe } = claude.app;
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
  if (quitAfter) setTimeout(() => app.quit(), 0); // after the reply reaches the window
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
  const claude = await findClaude();
  if (claude.state !== 'found') throw new Error(claude.state === 'failed' ? `Claude.exe lookup failed: ${claude.reason}` : 'Claude is not installed');
  await launchClaude(claude.app.exe, null);
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
  const final = !['starting', 'waiting', 'saving', 'checking', 'notFound', 'notSaved'].includes(status.phase);
  signInStatus = final ? null : status;
  if (final) lastSignInOutcome = status;
  if (status.phase === 'done') signedInTracker.forget(status.account.id);
  if (status.phase === 'done') {
    const { account } = status;
    // A failed config write must not leave the dialog on "saving": the status is sent anyway.
    await store.update((c) => afterSignIn(c, account)).catch((err: unknown) =>
      console.warn(`Could not save the signed-in card: ${(err as Error).message}`));
  }
  win?.webContents.send('launcher:signIn', status);
}

/**
 * Finds the default profile (see resolveDefaultProfile) and writes the folders checked to sign-in-check.log.
 * null = not found with confidence: sign-in stays off, opening accounts keeps working.
 */
async function lookUpDefaultProfile(knownFamily?: string | null): Promise<string | null> {
  if (!onWindows) return null;
  const found = await resolveDefaultProfile({
    run: runPowerShell,
    env: process.env,
    knownFamily,
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

const markerFile = markerFileFor(process.env);
const flow = onWindows && markerFile ? new SignInFlow({
  userProfile,
  markerFile,
  // Only the default instance: extra accounts (own --user-data-dir) stay open during Add account.
  listDefaultPids: async () => pidsForProfile(await queryClaudeProcesses(runPowerShell), null),
  // One query with window handles: only a main Claude with a visible window is reopened after the sign-in.
  listDefaultWindows: async () => {
    const procs = await queryClaudeWindows(runPowerShell);
    return { pids: pidsForProfile(procs, null), visible: windowPid(procs, null) !== null };
  },
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
// Detection: a new account-related key name in config.json, checked every ~1 s while a sign-in is open.
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
  // Claude.exe first (usually the cache, instant): its PackageFamilyName spares the profile lookup a PowerShell call.
  const claude = await findClaude();
  logTiming(`start: find Claude.exe: ${claude.state === 'found' ? claude.source : claude.state}: ${Date.now() - t0} ms`);
  if (claude.state !== 'found') return result(store.current, lookupError(claude));
  logTiming(`start: Claude version: ${claudeVersion(claude.app.exe) ?? 'unknown'}`);
  const t1 = Date.now();
  // Never the cached value: only a fresh lookup is safe before moving the main profile.
  const slot = await mainProfile.lookUpNow().catch((err: unknown) => {
    console.warn(`Main profile lookup failed: ${(err as Error).message}`);
    return null;
  });
  logTiming(`start: find the main profile: ${Date.now() - t1} ms`);
  if (!slot) return result(store.current, 'noProfile');

  let account: MarkerAccount;
  if ('label' in target) {
    const added = addAccount(store.current, target.label, userProfile, existsSync);
    const details = checkDetails(target.email, target.realName);
    if (!added?.account.profileDir || !added.account.label || 'error' in details) return result(store.current);
    account = {
      id: added.account.id, label: added.account.label, profileDir: added.account.profileDir, isNew: true, ...details,
    };
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
  photos.delete(id);
  await deletePhoto(photosDir, id).catch((err: unknown) => console.warn(`Could not delete the photo: ${(err as Error).message}`));
  return result(await store.update((c) => removeAccount(c, id)));
}

const isText = (value: unknown): value is string => typeof value === 'string';

// ---------- Receive memories from… (Phase 5.1) ----------

/** The pasted text lives only inside this object (never on disk, never in a log). */
const memories = new MemoryTransfer({
  open: async (id) => (await openAccount(id, false)).error,
  writeClipboard: (text) => clipboard.writeText(text),
  readClipboard: () => clipboard.readText().catch(() => ''),
  log: logTiming,
});

async function beginMemories(sourceId: string, targetId: string): Promise<ActionError | null> {
  if (flow?.active) return 'pending';
  const cfg = store.current;
  const sources = memorySources(cfg.accounts, targetId, signedInTracker.cards(cfg.accounts, lastRunning));
  if (!sources.some((a) => a.id === sourceId)) return 'notSignedIn';
  await memories.begin(sourceId, targetId);
  return null;
}

function registerIpc(): void {
  ipcMain.handle('launcher:getState', () => state(store.current));
  ipcMain.handle('launcher:setGreetingName', async (_e, name: unknown) =>
    state(await store.update((c) => setGreetingName(c, isText(name) ? name : null))));
  ipcMain.handle('launcher:renameAccount', async (_e, id: unknown, label: unknown) => {
    if (!isText(id) || !isText(label)) throw new Error('Invalid arguments');
    return state(await store.update((c) => renameAccount(c, id, label)));
  });
  ipcMain.handle('launcher:setDetails', async (_e, id: unknown, email: unknown, realName: unknown) => {
    if (!isText(id) || !isText(email) || !isText(realName)) throw new Error('Invalid arguments');
    return state(await store.update((c) => setDetails(c, id, email, realName)));
  });
  ipcMain.handle('launcher:setPhoto', async (_e, id: unknown, dataUrl: unknown) => {
    if (!isText(id) || (dataUrl !== null && !isText(dataUrl))) throw new Error('Invalid arguments');
    if (!store.current.accounts.some((a) => a.id === id)) return state(store.current);
    if (dataUrl === null) {
      photos.delete(id);
      await deletePhoto(photosDir, id);
      return state(await store.update((c) => setPhoto(c, id, null)));
    }
    const name = await savePhoto(photosDir, id, dataUrl);
    if (!name) throw new Error('Not a valid photo');
    photos.set(id, dataUrl);
    return state(await store.update((c) => setPhoto(c, id, name)));
  });
  ipcMain.handle('launcher:openAccount', (_e, id: unknown) => {
    if (!isText(id)) throw new Error('Invalid arguments');
    return openAccount(id);
  });
  ipcMain.handle('launcher:startSignIn', (_e, target: unknown) => {
    const t = (typeof target === 'object' && target !== null ? target : {}) as Record<string, unknown>;
    if (isText(t.label) && isText(t.email)) return startSignIn({ label: t.label, email: t.email, realName: isText(t.realName) ? t.realName : '' });
    if (isText(t.accountId)) return startSignIn({ accountId: t.accountId });
    throw new Error('Invalid arguments');
  });
  ipcMain.handle('launcher:confirmSignIn', () => flow?.confirm());
  ipcMain.handle('launcher:cancelSignIn', () => flow?.cancel());
  ipcMain.handle('launcher:waitLongerSignIn', () => flow?.waitLonger());
  ipcMain.handle('launcher:closeAccount', (_e, id: unknown) => {
    if (!isText(id)) throw new Error('Invalid arguments');
    return closeAccount(id);
  });
  ipcMain.handle('launcher:removeAccount', (_e, id: unknown, closeFirst: unknown) => {
    if (!isText(id)) throw new Error('Invalid arguments');
    return removeExisting(id, closeFirst === true);
  });
  ipcMain.handle('launcher:runningAccounts', () => runningIds());
  ipcMain.handle('launcher:cardsShown', () => { void onCardsShown(); });
  ipcMain.handle('launcher:memories:begin', (_e, sourceId: unknown, targetId: unknown) => {
    if (!isText(sourceId) || !isText(targetId)) throw new Error('Invalid arguments');
    return beginMemories(sourceId, targetId);
  });
  ipcMain.handle('launcher:memories:proceed', () => memories.proceed());
  ipcMain.handle('launcher:memories:useParts', (_e, parts: unknown) => {
    if (!Array.isArray(parts) || !parts.every(isText)) throw new Error('Invalid arguments');
    return memories.useParts(parts);
  });
  ipcMain.handle('launcher:memories:copyPart', (_e, index: unknown) => {
    if (typeof index !== 'number') throw new Error('Invalid arguments');
    return memories.copyPart(index);
  });
  ipcMain.handle('launcher:memories:finish', () => memories.finish());
  ipcMain.handle('launcher:memories:cancel', () => memories.cancel());
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
  // Receive memories: the text goes with the window (and off the clipboard) before it closes.
  w.on('close', (e) => {
    if (!flow?.active && memories.step === null) return;
    e.preventDefault();
    void memories.cancel()
      .then(() => flow?.active ? flow.cancel() : undefined)
      .finally(() => w.destroy());
  });
  w.on('closed', () => { win = null; });
  w.loadFile(path.join(here, '..', 'renderer', 'index.html'));
}

async function start(): Promise<void> {
  await app.whenReady();
  startup.ready = performance.now();
  // Before anything else: an interrupted sign-in leaves a marker (WINDOWS.md §4).
  const marker = flow ? await flow.pending() : null;
  // First run: only Main. Phase 2 sample accounts (demo-*) are dropped by parseConfig.
  await store.load(defaultConfig);
  signedInTracker.seed(store.current.accounts);
  // Small files (256 × 256 PNG), read once so the cards never wait for them.
  await Promise.all(store.current.accounts.map(async (a) => {
    const url = a.photo ? await readPhoto(photosDir, a.photo) : null;
    if (url) photos.set(a.id, url);
  }));
  startup.config = performance.now();
  if (marker) await recoverSignIn(marker);
  windowsName = new CachedLookup<string>({
    cached: store.current.windowsName ?? undefined,
    lookUp: () => (onWindows
      ? windowsDisplayName(process.env, runPowerShell)
      : Promise.resolve(cleanDisplayName('', process.env.USERNAME ?? process.env.USER))),
    save: async (name) => { await store.update((c) => setStartupCache(c, { windowsName: name })); },
    onChange: cardsChanged,
  });
  // After the recovery, which may put the main profile back. A cached folder that is gone is looked up at once.
  // The lookup also fills the Claude.exe cache on the first run.
  const savedProfile = store.current.defaultProfile;
  mainProfile = new CachedLookup<string | null>({
    cached: savedProfile && existsSync(savedProfile) ? savedProfile : undefined,
    lookUp: async () => {
      const claude = await findClaude();
      return lookUpDefaultProfile(claude.state === 'found' ? claude.app.family : undefined);
    },
    save: async (dir) => { await store.update((c) => setStartupCache(c, { defaultProfile: dir })); },
    onChange: cardsChanged,
  });
  registerIpc();
  createWindow();
  startup.window = performance.now();
}

start().catch((err: unknown) => {
  dialog.showErrorBox(strings.appName, err instanceof Error ? err.message : String(err));
  app.quit();
});
app.on('window-all-closed', () => app.quit());
