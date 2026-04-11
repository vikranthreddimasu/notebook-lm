// apps/desktop/electron/updater.cjs
const { dialog, shell } = require('electron');

let autoUpdater = null;

// electron-updater is only available in packaged builds.
// In dev, we skip auto-update entirely.
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (_) {
  // Not available in dev — that's fine.
}

function initUpdater(mainWindow) {
  if (!autoUpdater) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `Notebook LM v${info.version} is available.`,
        detail: 'Would you like to download it now?',
        buttons: ['Download from GitHub', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          const url = `https://github.com/vikranth1000/notebook-lm/releases/tag/v${info.version}`;
          shell.openExternal(url);
        }
      });
  });

  autoUpdater.on('error', (err) => {
    // Silently ignore update errors — not critical
    console.error('[updater] Error checking for updates:', err.message);
  });
}

function checkForUpdates() {
  if (!autoUpdater) {
    shell.openExternal('https://github.com/vikranth1000/notebook-lm/releases');
    return;
  }
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[updater] Check failed:', err.message);
    // Fallback: open releases page
    shell.openExternal('https://github.com/vikranth1000/notebook-lm/releases');
  });
}

module.exports = { initUpdater, checkForUpdates };
