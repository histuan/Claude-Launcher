// 0.6.2: started during an update install; version helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTALL_WINDOW_MS, installerRunning, mayBeInstalling, pendingInstallerName, updaterCacheDirName,
} from '../src/core/updateInstall.js';
import { isNewerVersion, releasePageUrl } from '../src/core/version.js';
import type { RawProcess } from '../src/core/processes.js';

const proc = (exe: string | null): RawProcess => ({ pid: 1, parentPid: null, exe, args: [] });
const INSTALLER = 'C:\\Users\\me\\AppData\\Local\\claude-launcher-updater\\pending\\Claude-Launcher-Setup-0.6.3.exe';

test('pending installer name: only a plain .exe name from update-info.json', () => {
  assert.equal(pendingInstallerName('{"fileName":"Claude-Launcher-Setup-0.6.3.exe","sha512":"x"}'), 'Claude-Launcher-Setup-0.6.3.exe');
  assert.equal(pendingInstallerName('{"fileName":"..\\\\evil.exe"}'), null);
  assert.equal(pendingInstallerName('{"fileName":"setup.zip"}'), null);
  assert.equal(pendingInstallerName('not json'), null);
});

test('process query only for a recent download, and never when the installer started us', () => {
  const now = 1_000_000_000;
  assert.equal(mayBeInstalling(now - 30_000, now, ['launcher.exe']), true);
  assert.equal(mayBeInstalling(now - 30_000, now, ['launcher.exe', '--updated']), false);
  assert.equal(mayBeInstalling(now - INSTALL_WINDOW_MS - 1, now, []), false);
  assert.equal(mayBeInstalling(null, now, []), false);
});

test('installer running = a process from exactly that file (case-insensitive)', () => {
  assert.equal(installerRunning([proc('C:\\x\\a.exe'), proc(INSTALLER.toUpperCase())], INSTALLER), true);
  assert.equal(installerRunning([proc('C:\\Other\\Claude-Launcher-Setup-0.6.3.exe'), proc(null)], INSTALLER), false);
  assert.equal(installerRunning([], INSTALLER), false);
});

test('updater cache folder from app-update.yml', () => {
  assert.equal(updaterCacheDirName('owner: histuan\nupdaterCacheDirName: claude-launcher-updater\n'), 'claude-launcher-updater');
  assert.equal(updaterCacheDirName('owner: histuan\n'), null);
});

test('newer version: numeric x.y.z only', () => {
  assert.equal(isNewerVersion('0.6.10', '0.6.2'), true);
  assert.equal(isNewerVersion('0.6.2', '0.6.2'), false);
  assert.equal(isNewerVersion('0.6.1', '0.6.2'), false);
  assert.equal(isNewerVersion('1.0.0', '0.9.9'), true);
  assert.equal(isNewerVersion('garbage', '0.6.2'), false);
});

test('release page of a version', () => {
  const base = 'https://github.com/histuan/Claude-Launcher/releases';
  assert.equal(releasePageUrl(base, '0.6.2'), `${base}/tag/v0.6.2`);
  assert.equal(releasePageUrl(base, 'x/../y'), base);
});
