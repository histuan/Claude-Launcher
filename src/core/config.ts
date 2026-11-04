// Launcher config (JSON in userData). Pure functions: they never mutate the input.
// The Main account is the default Claude profile: profileDir null, always first, cannot be removed.
import path from 'node:path';
import { checkDetails } from './details.js';
import { isDesktopExe } from './processes.js';

export const CONFIG_VERSION = 1;
export const MAX_NAME_LENGTH = 40;

export interface Account {
  id: string;
  /** Card name. null only on Main, meaning "use the default text from strings.ts". */
  label: string | null;
  email: string | null;
  realName: string | null;
  photo: string | null;
  /** Claude --user-data-dir. null = Main (default profile, no flag). */
  profileDir: string | null;
  /** Last known signed-in state (shown at once on startup; the background cookie check updates it). null = unknown. */
  signedIn: boolean | null;
}

/** Last resolved Claude.exe and its PackageFamilyName (saves a slow PowerShell start on every click). */
export interface CachedClaude {
  exe: string;
  family: string | null;
}

export interface LauncherConfig {
  version: number;
  /** Name typed by the person; null = use the Windows name. */
  greetingName: string | null;
  accounts: Account[];
  /** null = not looked up yet. Used only while the exe still exists (an update changes the folder). */
  claudeApp: CachedClaude | null;
}

export const isMain = (account: Account): boolean => account.profileDir === null;

const MAIN: Account = { id: 'main', label: null, email: null, realName: null, photo: null, profileDir: null, signedIn: null };

export function profileDirFor(userProfile: string, id: string): string {
  return path.win32.join(userProfile, 'ClaudeProfiles', id);
}

export function defaultConfig(): LauncherConfig {
  return { version: CONFIG_VERSION, greetingName: null, accounts: [{ ...MAIN }], claudeApp: null };
}

/** Only direct children of %USERPROFILE%\ClaudeProfiles may be created or deleted by the launcher. */
export function isLauncherProfileDir(dir: string, userProfile: string): boolean {
  if (!dir.trim()) return false;
  const norm = (p: string): string => path.win32.normalize(p).replace(/\\+$/, '').toLowerCase();
  const full = norm(dir);
  return path.win32.dirname(full) === norm(profileDirFor(userProfile, '')) && path.win32.basename(full) !== '';
}

// Phase 2 seeded these sample accounts; they are dropped when an old config is read.
const DEMO_IDS = new Set(['demo-work', 'demo-college']);
// Windows device names cannot be folder names.
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com\d|lpt\d)$/;

/** Folder-safe id from the card name: ASCII letters, digits and dashes. */
function slugFor(label: string): string {
  const slug = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
  return slug || 'account';
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Only an MSIX Claude.exe path is trusted from disk: anything else is dropped (looked up again). */
function parseCachedClaude(value: unknown): CachedClaude | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const exe = text(v.exe);
  return exe && isDesktopExe(exe) ? { exe, family: text(v.family) || null } : null;
}

function cleanName(value: string | null): string | null {
  const name = (value ?? '').trim().slice(0, MAX_NAME_LENGTH);
  return name || null;
}

/** Validates data read from disk. Throws if it is not a config at all. */
export function parseConfig(raw: unknown): LauncherConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('Config is not an object');
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.accounts)) throw new Error('Config has no accounts list');

  let main: Account | null = null;
  const others: Account[] = [];
  const seen = new Set<string>();
  for (const item of data.accounts as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const a = item as Record<string, unknown>;
    const id = text(a.id);
    if (!id || seen.has(id) || DEMO_IDS.has(id)) continue;
    const account: Account = {
      id,
      label: text(a.label),
      email: text(a.email),
      realName: text(a.realName),
      photo: text(a.photo),
      profileDir: text(a.profileDir),
      signedIn: typeof a.signedIn === 'boolean' ? a.signedIn : null,
    };
    if (isMain(account)) {
      if (main) continue; // only one account may use the default profile
      main = account;
    } else {
      others.push(account);
    }
    seen.add(id);
  }

  return {
    version: CONFIG_VERSION,
    greetingName: cleanName(text(data.greetingName)),
    accounts: [main ?? { ...MAIN }, ...others],
    claudeApp: parseCachedClaude(data.claudeApp),
  };
}

export function setClaudeApp(cfg: LauncherConfig, app: CachedClaude): LauncherConfig {
  return { ...cfg, claudeApp: { ...app } };
}

export function setGreetingName(cfg: LauncherConfig, name: string | null): LauncherConfig {
  return { ...cfg, greetingName: cleanName(name) };
}

/** Empty name: Main goes back to its default text; other accounts keep their name. */
export function renameAccount(cfg: LauncherConfig, id: string, label: string): LauncherConfig {
  const target = cfg.accounts.find((a) => a.id === id);
  if (!target) return cfg;
  const name = cleanName(label);
  if (name === null && !isMain(target)) return cfg;
  return { ...cfg, accounts: cfg.accounts.map((a) => (a === target ? { ...a, label: name } : a)) };
}

/** After a successful sign-in: adds the new card (once) or marks the existing one as signed in. */
export function afterSignIn(
  cfg: LauncherConfig,
  account: { id: string; label: string; profileDir: string; isNew: boolean; email?: string | null; realName?: string | null },
): LauncherConfig {
  const { id, label, profileDir, isNew } = account;
  if (!isNew) return setSignedIn(cfg, id, true);
  if (cfg.accounts.some((a) => a.id === id)) return cfg;
  const details = checkDetails(account.email ?? '', account.realName ?? '');
  const email = 'error' in details ? null : details.email;
  const realName = 'error' in details ? null : details.realName;
  return { ...cfg, accounts: [...cfg.accounts, { id, label, email, realName, photo: null, profileDir, signedIn: true }] };
}

/** "Edit details" (any card, Main included). An invalid e-mail leaves the config as it is. */
export function setDetails(cfg: LauncherConfig, id: string, email: string, realName: string): LauncherConfig {
  const details = checkDetails(email, realName);
  if ('error' in details || !cfg.accounts.some((a) => a.id === id)) return cfg;
  return { ...cfg, accounts: cfg.accounts.map((a) => (a.id === id ? { ...a, ...details } : a)) };
}

/** Photo file name in userData/photos (null = back to the initial). */
export function setPhoto(cfg: LauncherConfig, id: string, photo: string | null): LauncherConfig {
  if (!cfg.accounts.some((a) => a.id === id)) return cfg;
  return { ...cfg, accounts: cfg.accounts.map((a) => (a.id === id ? { ...a, photo } : a)) };
}

/** Remembers the last known signed-in state of an extra account (unchanged config if it is already that). */
export function setSignedIn(cfg: LauncherConfig, id: string, signedIn: boolean): LauncherConfig {
  const target = cfg.accounts.find((a) => a.id === id);
  if (!target || isMain(target) || target.signedIn === signedIn) return cfg;
  return { ...cfg, accounts: cfg.accounts.map((a) => (a === target ? { ...a, signedIn } : a)) };
}

export function removeAccount(cfg: LauncherConfig, id: string): LauncherConfig {
  const target = cfg.accounts.find((a) => a.id === id);
  if (!target || isMain(target)) return cfg;
  return { ...cfg, accounts: cfg.accounts.filter((a) => a !== target) };
}

/**
 * New account with its own profile folder. `folderTaken` lets the caller skip ids whose folder already exists on disk.
 * Returns null for an empty name.
 */
export function addAccount(
  cfg: LauncherConfig,
  label: string,
  userProfile: string,
  folderTaken: (dir: string) => boolean = () => false,
): { config: LauncherConfig; account: Account } | null {
  const name = cleanName(label);
  if (name === null) return null;
  const base = slugFor(name);
  const used = new Set(cfg.accounts.map((a) => a.id.toLowerCase()));
  const free = (id: string): boolean =>
    !used.has(id) && !DEMO_IDS.has(id) && !WINDOWS_DEVICE.test(id) && !folderTaken(profileDirFor(userProfile, id));
  let id = base;
  for (let n = 2; !free(id); n++) id = `${base}-${n}`;
  const account: Account = { id, label: name, email: null, realName: null, photo: null, profileDir: profileDirFor(userProfile, id), signedIn: null };
  return { config: { ...cfg, accounts: [...cfg.accounts, account] }, account };
}
