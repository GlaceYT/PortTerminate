const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a', /* Tailwind slate-900 */
      symbolColor: '#f8fafc',
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Helper function to execute powershell
function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -EncodedCommand ${encodedScript}`, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        return reject(error);
      }
      resolve(stdout);
    });
  });
}

ipcMain.handle('get-ports', async () => {
  const psScript = `
    $ports = Get-NetTCPConnection -State Listen | Select-Object LocalPort, OwningProcess -Unique
    $result = @()
    foreach ($p in $ports) {
        if ($p.OwningProcess -eq 0 -or $p.OwningProcess -eq 4) { continue }
        $proc = Get-Process -Id $p.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            $name = $proc.ProcessName
            $isSystem = ($name -match '(?i)^(svchost|system|wininit|smss|lsass|csrss|services|spoolsv|SearchUI|TextInputHost|explorer|dwm)$' -or $proc.SessionId -eq 0)
            $result += [PSCustomObject]@{ Port = $p.LocalPort; PID = $p.OwningProcess; Name = $name; IsSystem = [bool]$isSystem }
        }
    }
    $result | ConvertTo-Json -Compress
  `;
  try {
    const out = await runPowerShell(psScript);
    if (!out.trim()) return [];
    const parsed = JSON.parse(out);

    let data = Array.isArray(parsed) ? parsed : [parsed];

    const uniquePorts = [];
    const map = new Set();
    for (const item of data) {
      if (!map.has(item.Port)) {
        map.add(item.Port);
        uniquePorts.push(item);
      }
    }

    return uniquePorts.sort((a, b) => a.Port - b.Port);
  } catch (err) {
    console.error('Failed to get ports', err);
    return { error: err.message };
  }
});

ipcMain.handle('kill-process', async (event, pid) => {
  return new Promise((resolve) => {
    exec(`taskkill /F /PID ${pid}`, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, message: stderr || error.message });
      } else {
        resolve({ success: true, message: stdout });
      }
    });
  });
});
