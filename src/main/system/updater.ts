// electron-updater with the GitHub provider (public repo, no token): the feed comes from app-update.yml, written by
// electron-builder from the "publish" setting in package.json. Nothing downloads or installs by itself.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import electronUpdater from 'electron-updater';
import type { SelfUpdateDeps } from '../selfUpdate.js';
import { DownloadWatch } from '../../core/updateDownload.js';
import { pendingInstallerName, updaterCacheDirName } from '../../core/updateInstall.js';

const { autoUpdater } = electronUpdater;

export function githubUpdater(): Pick<SelfUpdateDeps, 'check' | 'download' | 'install'> {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = null; // its lines carry URLs and paths; the launcher logs versions and timings only
  return {
    async check() {
      const result = await autoUpdater.checkForUpdates();
      return result?.isUpdateAvailable ? result.updateInfo.version : null;
    },
    // Differential when the installed version's installer is in the updater cache (the NSIS installer copies itself
    // there) and both .blockmap files are on the releases; otherwise electron-updater falls back to a full download.
    async download(onProgress) {
      const watch = new DownloadWatch();
      const listener = (p: { percent: number; transferred: number }): void => {
        watch.progress(p.transferred);
        onProgress(p.percent);
      };
      autoUpdater.logger = watch.logger; // keeps flags only, never the messages
      autoUpdater.on('download-progress', listener);
      try {
        await autoUpdater.downloadUpdate();
      } finally {
        autoUpdater.off('download-progress', listener);
        autoUpdater.logger = null;
      }
      return watch.result();
    },
    // Silent NSIS install (/S), then the launcher starts again (--force-run). Not the visible installer: with
    // oneClick false an update run (--updated) skips the license/folder pages but still stops on the Finish page,
    // which needs a click (app-builder-lib templates/nsis/assistedInstaller.nsh). The dialog says how long it takes.
    install: () => autoUpdater.quitAndInstall(true, true),
  };
}

export interface PendingInstaller {
  /** `%LOCALAPPDATA%\\<updater cache>\\pending\\<installer>.exe`: electron-updater runs the installer from there. */
  installer: string;
  /** When update-info.json was written (the download finished; the install starts right after). */
  savedMs: number;
}

/**
 * The installer of the last downloaded update, from electron-updater's pending update info, or null (none, or no
 * app-update.yml as in a dev build). Reads two small files; no process query.
 */
export async function pendingInstaller(localAppData: string | undefined, resourcesPath: string): Promise<PendingInstaller | null> {
  if (!localAppData) return null;
  try {
    const dirName = updaterCacheDirName(await readFile(path.join(resourcesPath, 'app-update.yml'), 'utf8'));
    if (!dirName) return null;
    const pending = path.win32.join(localAppData, dirName, 'pending');
    const info = path.win32.join(pending, 'update-info.json');
    const name = pendingInstallerName(await readFile(info, 'utf8'));
    if (!name) return null;
    return { installer: path.win32.join(pending, name), savedMs: (await stat(info)).mtimeMs };
  } catch {
    return null;
  }
}
