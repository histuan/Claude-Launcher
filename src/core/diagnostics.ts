// "Copy diagnostics" (0.7.0): a plain-text report for a bug report. Nothing personal: no e-mail, no account (real)
// name, no Windows or greeting name, no real user folder (written as %LOCALAPPDATA% / %APPDATA% / %USERPROFILE%), no
// token, cookie or memory text. Card labels are the only names shown. Pure: main.ts gathers the inputs.

export interface DiagnosticsAccount {
  /** Card label as shown (Main's default text when it has none). */
  label: string;
  /** 'signedIn' | 'signedOut' | 'checking' (the card's last known state). */
  state: 'signedIn' | 'signedOut' | 'checking';
  running: boolean;
}

export interface DiagnosticsInput {
  createdAt: Date;
  launcherVersion: string;
  /** null = Claude not found or its version unknown. */
  claudeVersion: string | null;
  windowsVersion: string;
  accounts: DiagnosticsAccount[];
  /** Cached paths (config): written with environment variables instead of the real folders. */
  paths: { claudeExe: string | null; mainProfile: string | null; extraProfiles: string; log: string };
  /** The whole sign-in-timings.log (only its last lines are used); '' when missing. */
  log: string;
  env: { LOCALAPPDATA?: string; APPDATA?: string; USERPROFILE?: string; USERNAME?: string };
  /** Every personal text known to the launcher (e-mails, real names, Windows and greeting names): removed. */
  personal: (string | null | undefined)[];
}

export interface DiagnosticsText {
  title: string;
  created: string;
  launcher: string;
  claude: string;
  unknown: string;
  windows: string;
  accounts: (count: number, signedIn: number) => string;
  states: Record<DiagnosticsAccount['state'], string>;
  running: string;
  paths: string;
  claudeExe: string;
  mainProfile: string;
  extraProfiles: string;
  logFile: string;
  notCached: string;
  logTail: (lines: number) => string;
  emptyLog: string;
}

export const DIAGNOSTICS_LOG_LINES = 50;

const EMAIL = /[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+\.[^\s@<>()[\]"',;:]+/g;
/** Long opaque values (a token or a cookie value, should one ever reach a log). */
const LONG_VALUE = /[A-Za-z0-9_-]{48,}/g;

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A folder in either slash style, case-insensitive (Windows paths), only at a path boundary. */
function folderPattern(dir: string): RegExp {
  const trimmed = dir.replace(/[\\/]+$/, '');
  const body = trimmed.split(/[\\/]+/).map(escapeRegExp).join('[\\\\/]+');
  return new RegExp(`${body}(?![\\p{L}\\p{N}])`, 'giu');
}

/** A whole word (letters and digits around it do not count), case-insensitive. */
function wordPattern(word: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, 'giu');
}

/**
 * Removes everything personal from a text: user folders become environment variables (the deepest first, so
 * %LOCALAPPDATA% wins over %USERPROFILE%), e-mails, known names and the Windows user name become placeholders.
 */
export function redact(text: string, env: DiagnosticsInput['env'], personal: DiagnosticsInput['personal']): string {
  let out = text;
  const folders = (['LOCALAPPDATA', 'APPDATA', 'USERPROFILE'] as const)
    .map((name) => ({ name, dir: env[name]?.trim() ?? '' }))
    .filter((f) => f.dir.length > 3) // never a bare drive such as "C:\"
    .sort((a, b) => b.dir.length - a.dir.length);
  for (const { name, dir } of folders) out = out.replace(folderPattern(dir), `%${name}%`);
  out = out.replace(EMAIL, '<e-mail>');
  const words = [...personal, env.USERNAME]
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const word of new Set(words)) out = out.replace(wordPattern(word), '<name>');
  return out.replace(LONG_VALUE, '<value>');
}

/** The report. Account labels are kept (only e-mails are removed from them); every other line is redacted. */
export function buildDiagnostics(input: DiagnosticsInput, text: DiagnosticsText): string {
  const clean = (s: string): string => redact(s, input.env, input.personal);
  const signedIn = input.accounts.filter((a) => a.state === 'signedIn').length;
  const tail = input.log.split(/\r?\n/).filter((l) => l.trim() !== '').slice(-DIAGNOSTICS_LOG_LINES);
  const path = (p: string | null): string => (p ? clean(p) : text.notCached);
  const lines = [
    text.title,
    `${text.created}: ${input.createdAt.toISOString()}`,
    `${text.launcher}: ${clean(input.launcherVersion)}`,
    `${text.claude}: ${input.claudeVersion ? clean(input.claudeVersion) : text.unknown}`,
    `${text.windows}: ${clean(input.windowsVersion)}`,
    '',
    text.accounts(input.accounts.length, signedIn),
    ...input.accounts.map((a) => `- ${a.label.replace(EMAIL, '<e-mail>')}: ${text.states[a.state]}${a.running ? `, ${text.running}` : ''}`),
    '',
    `${text.paths}:`,
    `- ${text.claudeExe}: ${path(input.paths.claudeExe)}`,
    `- ${text.mainProfile}: ${path(input.paths.mainProfile)}`,
    `- ${text.extraProfiles}: ${path(input.paths.extraProfiles)}`,
    `- ${text.logFile}: ${path(input.paths.log)}`,
    '',
    `${text.logTail(tail.length)}:`,
    ...(tail.length ? tail.map(clean) : [text.emptyLog]),
  ];
  return `${lines.join('\n')}\n`;
}
