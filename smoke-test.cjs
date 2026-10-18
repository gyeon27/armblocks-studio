const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { preload: path.join(__dirname, 'electron', 'preload.cjs'), contextIsolation: true, nodeIntegration: false } });
  await win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'armblocks-preview.png'), image.toPNG());
  console.log('smoke screenshot saved');
  app.quit();
});
