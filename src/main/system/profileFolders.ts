// Creates and deletes the launcher's profile folders. Only %USERPROFILE%\ClaudeProfiles\<id>: never the default profile.
import { mkdir, rm } from 'node:fs/promises';
import { isLauncherProfileDir } from '../../core/config.js';

function check(dir: string, userProfile: string): void {
  if (!isLauncherProfileDir(dir, userProfile)) throw new Error(`Refusing to touch a folder outside ClaudeProfiles: ${dir}`);
}

export async function createProfileDir(dir: string, userProfile: string): Promise<void> {
  check(dir, userProfile);
  await mkdir(dir, { recursive: true });
}

export async function deleteProfileDir(dir: string, userProfile: string): Promise<void> {
  check(dir, userProfile);
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}
