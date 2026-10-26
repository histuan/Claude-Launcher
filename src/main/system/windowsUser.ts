// Windows display name for the greeting (Win32_UserAccount.FullName, verified in Phase 0).
import { execFile } from 'node:child_process';
import { cleanDisplayName } from '../../core/name.js';

export type RunPowerShell = (script: string) => Promise<string>;

// WQL escapes a single quote as \' ; UTF-8 output keeps accented names intact.
const FULL_NAME_SCRIPT = [
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
  "$n = $env:USERNAME -replace \"'\", \"\\'\"",
  "$d = $env:USERDOMAIN -replace \"'\", \"\\'\"",
  "(Get-CimInstance Win32_UserAccount -Filter \"Name='$n' AND Domain='$d'\").FullName",
].join('; ');

export async function windowsDisplayName(
  env: Record<string, string | undefined>,
  run: RunPowerShell,
): Promise<string> {
  let fullName = '';
  try {
    fullName = await run(FULL_NAME_SCRIPT);
  } catch (err) {
    console.warn(`Could not read the Windows display name: ${(err as Error).message}`);
  }
  return cleanDisplayName(fullName, env.USERNAME);
}

export const runPowerShell: RunPowerShell = (script) =>
  new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 5000, encoding: 'utf8' },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
