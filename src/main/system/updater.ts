// electron-updater with the GitHub provider (public repo, no token): the feed comes from app-update.yml, written by
// electron-builder from the "publish" setting in package.json. Nothing downloads or installs by itself.
import electronUpdater from 'electron-updater';
import type { SelfUpdateDeps } from '../selfUpdate.js';
import { DownloadWatch } from '../../core/updateDownload.js';

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
    // Silent NSIS install (/S), then the launcher starts again.
    install: () => autoUpdater.quitAndInstall(true, true),
  };
}
