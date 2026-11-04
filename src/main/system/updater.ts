// electron-updater with the GitHub provider (public repo, no token): the feed comes from app-update.yml, written by
// electron-builder from the "publish" setting in package.json. Nothing downloads or installs by itself.
import electronUpdater from 'electron-updater';
import type { SelfUpdateDeps } from '../selfUpdate.js';

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
    async download(onProgress) {
      const listener = (p: { percent: number }): void => onProgress(p.percent);
      autoUpdater.on('download-progress', listener);
      try {
        await autoUpdater.downloadUpdate();
      } finally {
        autoUpdater.off('download-progress', listener);
      }
    },
    // Silent NSIS install (/S), then the launcher starts again.
    install: () => autoUpdater.quitAndInstall(true, true),
  };
}
