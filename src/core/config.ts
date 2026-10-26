// Launcher config (JSON in userData). Pure functions: they never mutate the input.
// The Main account is the default Claude profile: profileDir null, always first, cannot be removed.
import path from 'node:path';

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
}

export interface LauncherConfig {
  version: number;
  /** Name typed by the person; null = use the Windows name. */
  greetingName: string | null;
  accounts: Account[];
}

export const isMain = (account: Account): boolean => account.profileDir === null;

const MAIN: Account = { id: 'main', label: null, email: null, realName: null, photo: null, profileDir: null };

export function profileDirFor(userProfile: string, id: string): string {
  return path.win32.join(userProfile, 'ClaudeProfiles', id);
}

export function defaultConfig(): LauncherConfig {
  return { version: CONFIG_VERSION, greetingName: null, accounts: [{ ...MAIN }] };
}

/** Phase 2 only: sample accounts so the screen can be tried. Their ids start with "demo-". */
export function demoConfig(userProfile: string): LauncherConfig {
  const demo = (id: string, label: string, email: string, realName: string): Account =>
    ({ id, label, email, realName, photo: null, profileDir: profileDirFor(userProfile, id) });
  const cfg = defaultConfig();
  cfg.accounts.push(
    demo('demo-work', 'Work', 'me@company.example', 'Alex Morgan'),
    demo('demo-college', 'College', 'alex.morgan@university.example', 'Alex M.'),
  );
  return cfg;
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

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
    if (!id || seen.has(id)) continue;
    const account: Account = {
      id,
      label: text(a.label),
      email: text(a.email),
      realName: text(a.realName),
      photo: text(a.photo),
      profileDir: text(a.profileDir),
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
  };
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

export function removeAccount(cfg: LauncherConfig, id: string): LauncherConfig {
  const target = cfg.accounts.find((a) => a.id === id);
  if (!target || isMain(target)) return cfg;
  return { ...cfg, accounts: cfg.accounts.filter((a) => a !== target) };
}
