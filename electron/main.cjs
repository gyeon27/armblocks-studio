const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn, execFile } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

let mainWindow;
let uninstallWindow;
let monitorProcess;
let activeBuildPromise = null;
let activeBuildKey = '';
const ARDUINO_RUNTIME_VERSION = '0.1.5';

// IExpress는 임시 압축 폴더에서 설치 스크립트를 실행한 뒤 그 폴더를 삭제한다. 그 상태로 시작된 앱이
// 삭제된 작업 폴더를 물려받으면 Windows CreateProcess가 존재하는 avr-g++/cc1plus도 찾지 못한다.
// 패키지 앱은 시작 즉시 영구 설치 폴더를 작업 폴더로 사용한다.
if (app.isPackaged) {
  try { process.chdir(path.dirname(process.execPath)); } catch {}
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); }
  catch { return { cliPath: 'arduino-cli', fqbn: 'arduino:avr:uno' }; }
}

function saveSettings(next) {
  const merged = { ...readSettings(), ...next };
  fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2));
  return merged;
}

function compareVersions(left, right) {
  const a = String(left).split('.').map((value) => Number.parseInt(value, 10) || 0);
  const b = String(right).split('.').map((value) => Number.parseInt(value, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}

function bundledArduinoRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'arduino')
    : path.join(app.getAppPath(), 'vendor', 'arduino-runtime');
}

function portableArduinoRoot() {
  return path.join(app.getPath('userData'), 'arduino-runtime', ARDUINO_RUNTIME_VERSION);
}

async function ensureArduinoRuntime(onLine) {
  const source = bundledArduinoRoot();
  if (!app.isPackaged || !process.env.PORTABLE_EXECUTABLE_DIR) return source;

  const target = portableArduinoRoot();
  const cliName = process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli';
  const marker = path.join(target, '.armblocks-runtime-ready');
  if (fs.existsSync(marker) && fs.existsSync(path.join(target, cliName))) return target;

  onLine?.('포터블 Arduino 도구를 처음 한 번만 준비하고 있습니다…\n', 'stdout');
  await fs.promises.mkdir(target, { recursive: true });
  await fs.promises.cp(source, target, { recursive: true, force: true });
  await fs.promises.writeFile(marker, JSON.stringify({ version: ARDUINO_RUNTIME_VERSION }), 'utf8');
  onLine?.('Arduino 도구 준비 완료. 다음 컴파일부터 이 단계를 건너뜁니다.\n', 'stdout');
  return target;
}

function resolveCliPath(arduinoRoot = bundledArduinoRoot()) {
  const bundled = path.join(arduinoRoot, process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');
  if (fs.existsSync(bundled)) return bundled;
  return readSettings().cliPath || 'arduino-cli';
}

function resolveAvrdude(arduinoRoot) {
  const toolsRoot = path.join(arduinoRoot, 'data', 'packages', 'arduino', 'tools', 'avrdude');
  if (!fs.existsSync(toolsRoot)) return null;
  const versions = fs.readdirSync(toolsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  for (const version of versions) {
    const executable = path.join(toolsRoot, version, 'bin', process.platform === 'win32' ? 'avrdude.exe' : 'avrdude');
    const config = path.join(toolsRoot, version, 'etc', 'avrdude.conf');
    if (fs.existsSync(executable) && fs.existsSync(config)) return { executable, config };
  }
  return null;
}

function runExecutable(executable, args, onLine) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, { windowsHide: true, cwd: path.dirname(executable) });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const value = chunk.toString(); stdout += value; onLine?.(value, 'stdout');
    });
    child.stderr.on('data', (chunk) => {
      const value = chunk.toString(); stderr += value; onLine?.(value, 'stderr');
    });
    child.on('error', (error) => resolve({ ok: false, code: -1, stdout, stderr: error.message }));
    child.on('close', (code) => resolve({ ok: code === 0, code, stdout, stderr }));
  });
}

async function closeMonitor() {
  const activeProcess = monitorProcess;
  if (!activeProcess) return;
  monitorProcess = null;
  await new Promise((resolve) => {
    let finished = false;
    const done = () => { if (!finished) { finished = true; resolve(); } };
    if (activeProcess.exitCode !== null || activeProcess.signalCode !== null) return done();
    activeProcess.once('close', done);
    // stdin을 닫으면 모니터 스크립트가 포트를 정상적으로 닫고 종료한다.
    try { activeProcess.stdin?.end(); } catch {}
    setTimeout(() => { if (!finished) { try { activeProcess.kill(); } catch {} } done(); }, 1500);
  });
}

function friendlySerialError(raw, portPath) {
  const text = String(raw || '').trim();
  if (/access|denied|액세스|거부|사용 중|in use/i.test(text)) {
    return `${portPath}를 다른 프로그램이 사용 중입니다. Arduino IDE·다른 시리얼 모니터를 닫거나, 업로드 직후라면 잠시 뒤 다시 시도하세요.`;
  }
  if (/does not exist|존재하지|not found|찾을 수/i.test(text)) return `${portPath} 포트를 찾을 수 없습니다. USB 연결을 확인하고 포트를 새로고침하세요.`;
  const line = text.split(/\r?\n/).map((value) => value.trim()).find(Boolean);
  return line || '포트를 열지 못했습니다.';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#f4f1ea',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (app.isPackaged) mainWindow.loadFile(path.join(__dirname, '..', 'renderer-dist', 'index.html'));
  else mainWindow.loadURL('http://127.0.0.1:5173');
}

function createUninstallWindow() {
  if (uninstallWindow && !uninstallWindow.isDestroyed()) {
    uninstallWindow.show();
    uninstallWindow.focus();
    return;
  }
  const uninstallHtml = `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ArmBlocks Studio 제거</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f5f2eb;color:#272824;font-family:"Segoe UI","Malgun Gothic",sans-serif}.wrap{padding:28px 30px 24px}.brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}.mark{display:grid;place-items:center;width:44px;height:44px;border-radius:11px;background:#292a27;color:white;font-weight:800}.brand strong{display:block;font-size:19px}.brand small{color:#797a73;letter-spacing:.08em}.card{background:#fff;border:1px solid #ddd8cc;border-radius:16px;padding:22px;box-shadow:0 8px 28px #534c3b12}h1{font-size:22px;margin:0 0 8px}p{margin:0;color:#66675f;line-height:1.55}.items{display:grid;gap:9px;margin:20px 0}.item{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;background:#f7f6f2;font-size:14px}.dot{width:8px;height:8px;border-radius:50%;background:#c5433d}.keep{margin-top:12px;font-size:13px;color:#36806f}.option{display:flex;gap:9px;align-items:flex-start;margin:16px 0;font-size:13px;color:#4f514c}.option input{margin-top:3px}.actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}button{border:1px solid #d6d2c8;border-radius:10px;padding:10px 17px;background:#fff;font-weight:700;cursor:pointer}button.danger{background:#bd3937;border-color:#bd3937;color:#fff}button:disabled{opacity:.55;cursor:default}.progress{display:none;margin-top:22px}.bar{height:10px;border-radius:99px;background:#e5e1d8;overflow:hidden}.fill{height:100%;width:0;background:#178b83;transition:width .25s ease}.status{font-weight:700;margin:14px 0 4px}.detail{font-size:13px;color:#71736c}.error{color:#b02e2e}
  </style></head><body><div class="wrap"><div class="brand"><div class="mark">AB</div><div><strong>ArmBlocks Studio</strong><small>UNINSTALLER</small></div></div><div class="card"><section id="confirm"><h1>ArmBlocks Studio를 제거할까요?</h1><p>다음 앱 구성 요소를 이 컴퓨터에서 제거합니다.</p><div class="items"><div class="item"><span class="dot"></span>ArmBlocks Studio 앱 파일</div><div class="item"><span class="dot"></span>Arduino CLI · AVR 코어 · Servo 라이브러리</div><div class="item"><span class="dot"></span>바탕화면 및 시작 메뉴 바로가기</div><div class="item"><span class="dot"></span>Windows 앱 등록 정보</div></div><div class="keep">직접 저장한 .armblocks 프로젝트 파일은 삭제하지 않습니다.</div><label class="option"><input id="removeData" type="checkbox" checked><span>앱 설정, 자동 저장본과 컴파일 캐시도 함께 삭제</span></label><div class="actions"><button onclick="window.close()">취소</button><button class="danger" id="removeButton">제거</button></div></section><section class="progress" id="progress"><h1>제거하는 중…</h1><div class="bar"><div class="fill" id="fill"></div></div><div class="status" id="status">준비 중</div><div class="detail" id="detail">잠시만 기다려 주세요.</div></section></div></div><script>
    const button=document.querySelector('#removeButton');
    button.addEventListener('click',async()=>{button.disabled=true;document.querySelector('#confirm').style.display='none';document.querySelector('#progress').style.display='block';const result=await window.robotAPI.startUninstall({removeUserData:document.querySelector('#removeData').checked});if(result&&!result.ok){document.querySelector('#status').textContent='제거하지 못했습니다';document.querySelector('#status').className='status error';document.querySelector('#detail').textContent=result.error;}});
    window.robotAPI.onUninstallProgress(({percent,status,detail})=>{document.querySelector('#fill').style.width=percent+'%';document.querySelector('#status').textContent=status;document.querySelector('#detail').textContent=detail||'';});
  </script></body></html>`;
  uninstallWindow = new BrowserWindow({
    width: 600,
    height: 620,
    resizable: false,
    maximizable: false,
    backgroundColor: '#f5f2eb',
    title: `ArmBlocks Studio ${app.getVersion()} 제거`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  uninstallWindow.setMenuBarVisibility(false);
  uninstallWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(uninstallHtml)}`);
  uninstallWindow.on('closed', () => { uninstallWindow = null; });
}

function sendUninstallProgress(percent, status, detail) {
  uninstallWindow?.webContents.send('uninstall:progress', { percent, status, detail });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runCli(args, onLine) {
  let arduinoRoot;
  try {
    arduinoRoot = await ensureArduinoRuntime(onLine);
  } catch (error) {
    return { ok: false, code: -1, stdout: '', stderr: `Arduino 도구 준비 실패: ${error.message}` };
  }
  const cli = resolveCliPath(arduinoRoot);
  const hasBundledRuntime = fs.existsSync(path.join(arduinoRoot, 'data'));
  const cliEnvironment = { ...process.env, ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false' };
  if (hasBundledRuntime) {
    cliEnvironment.ARDUINO_DIRECTORIES_DATA = path.join(arduinoRoot, 'data');
    cliEnvironment.ARDUINO_DIRECTORIES_USER = path.join(arduinoRoot, 'user');
    cliEnvironment.ARDUINO_DIRECTORIES_DOWNLOADS = path.join(app.getPath('userData'), 'arduino-downloads');
  }
  return new Promise((resolve) => {
    const child = spawn(cli, args, { windowsHide: true, cwd: arduinoRoot, env: cliEnvironment });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const value = chunk.toString(); stdout += value; onLine?.(value, 'stdout');
    });
    child.stderr.on('data', (chunk) => {
      const value = chunk.toString(); stderr += value; onLine?.(value, 'stderr');
    });
    child.on('error', (error) => resolve({ ok: false, code: -1, stdout, stderr: error.message }));
    child.on('close', (code) => resolve({ ok: code === 0, code, stdout, stderr }));
  });
}

ipcMain.handle('settings:get', () => readSettings());
ipcMain.handle('settings:save', (_event, value) => saveSettings(value));
ipcMain.handle('uninstall:start', async (event, options = {}) => {
  if (!uninstallWindow || event.sender !== uninstallWindow.webContents) return { ok: false, error: '올바른 제거 창이 아닙니다.' };
  try {
    sendUninstallProgress(10, '실행 중인 기능을 정리하고 있습니다', '시리얼 연결과 백그라운드 작업을 종료합니다.');
    await closeMonitor();
    await wait(250);

    sendUninstallProgress(30, '바로가기를 삭제하고 있습니다', '바탕화면과 시작 메뉴 항목을 정리합니다.');
    fs.rmSync(path.join(app.getPath('desktop'), 'ArmBlocks Studio.lnk'), { force: true });
    const startMenuDirectory = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'ArmBlocks Studio');
    fs.rmSync(startMenuDirectory, { recursive: true, force: true });
    await wait(250);

    sendUninstallProgress(55, 'Windows 앱 등록 정보를 지우고 있습니다', '설치된 앱 목록에서 ArmBlocks Studio를 제거합니다.');
    const registryKeys = [
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ArmBlocksStudio',
      'HKCU\\Software\\ArmBlocksStudio'
    ];
    await Promise.all(registryKeys.map((registryKey) => new Promise((resolve) => {
      execFile('reg.exe', ['delete', registryKey, '/f'], { windowsHide: true }, () => resolve());
    })));

    sendUninstallProgress(75, '앱과 Arduino 리소스를 삭제할 준비 중입니다', 'Arduino CLI, AVR 코어, Servo 라이브러리와 앱 파일을 정리합니다.');
    const installDirectory = path.dirname(process.execPath);
    const cleanupPath = path.join(app.getPath('temp'), `armblocks-uninstall-${process.pid}.ps1`);
    const cleanupScript = `param([int]$ParentProcessId,[string]$InstallDirectory,[string]$UserDataDirectory)\n$ErrorActionPreference='SilentlyContinue'\nWait-Process -Id $ParentProcessId -ErrorAction SilentlyContinue\nStart-Sleep -Milliseconds 800\nif ($UserDataDirectory) { Remove-Item -LiteralPath $UserDataDirectory -Recurse -Force }\nRemove-Item -LiteralPath $InstallDirectory -Recurse -Force\nRemove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force\n`;
    fs.writeFileSync(cleanupPath, cleanupScript, 'utf8');
    const userDataDirectory = options.removeUserData ? app.getPath('userData') : '';
    const cleanup = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', cleanupPath, process.pid.toString(), installDirectory, userDataDirectory], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore'
    });
    cleanup.unref();
    sendUninstallProgress(100, '제거 준비가 완료되었습니다', '창이 닫힌 뒤 남은 앱 파일을 마무리합니다.');
    setTimeout(() => app.quit(), 900);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});
ipcMain.handle('app:install-update', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: `ArmBlocks Studio ${app.getVersion()} 업데이트 파일 선택`,
    properties: ['openFile'],
    filters: [{ name: 'ArmBlocks Studio 설치 파일', extensions: ['exe'] }]
  });
  if (result.canceled) return null;
  const installerPath = result.filePaths[0];
  const match = /^ArmBlocks-Studio-Setup-(\d+\.\d+\.\d+)\.exe$/i.exec(path.basename(installerPath));
  if (!match) return { ok: false, error: 'ArmBlocks-Studio-Setup-버전.exe 형식의 설치 파일을 선택하세요.' };
  if (compareVersions(match[1], app.getVersion()) <= 0) {
    return { ok: false, error: `선택한 ${match[1]} 버전은 현재 ${app.getVersion()}보다 새 버전이 아닙니다.` };
  }
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['업데이트', '취소'],
    defaultId: 0,
    cancelId: 1,
    title: 'ArmBlocks Studio 업데이트',
    message: `${app.getVersion()} → ${match[1]} 업데이트`,
    detail: '앱을 종료하고 선택한 설치 파일을 실행합니다. 저장하지 않은 프로젝트가 있다면 먼저 취소하고 저장하세요.'
  });
  if (confirmation.response !== 0) return null;
  try {
    const installer = spawn(installerPath, [], { detached: true, stdio: 'ignore', windowsHide: false });
    installer.unref();
    setTimeout(() => app.quit(), 300);
    return { ok: true, version: match[1] };
  } catch (error) {
    return { ok: false, error: `업데이트 설치 파일을 실행하지 못했습니다: ${error.message}` };
  }
});
ipcMain.handle('project:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'ArmBlocks 프로젝트 열기',
    properties: ['openFile'],
    filters: [{ name: 'ArmBlocks 프로젝트', extensions: ['armblocks'] }, { name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled) return null;
  try {
    const filePath = result.filePaths[0];
    const stat = fs.statSync(filePath);
    if (stat.size > 2 * 1024 * 1024) throw new Error('프로젝트 파일은 2MB를 넘을 수 없습니다.');
    return { ok: true, filePath, content: fs.readFileSync(filePath, 'utf8') };
  } catch (error) { return { ok: false, error: error.message }; }
});
ipcMain.handle('project:save', async (_event, payload) => {
  if (!payload || typeof payload.content !== 'string' || payload.content.length > 2 * 1024 * 1024) {
    return { ok: false, error: '저장할 프로젝트 데이터가 올바르지 않습니다.' };
  }
  let filePath = payload.filePath;
  if (!filePath || payload.saveAs) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'ArmBlocks 프로젝트 저장',
      defaultPath: payload.suggestedName || '내 로봇팔.armblocks',
      filters: [{ name: 'ArmBlocks 프로젝트', extensions: ['armblocks'] }]
    });
    if (result.canceled) return null;
    filePath = result.filePath;
  }
  if (!filePath.toLowerCase().endsWith('.armblocks')) filePath += '.armblocks';
  try {
    fs.writeFileSync(filePath, payload.content, 'utf8');
    return { ok: true, filePath };
  } catch (error) { return { ok: false, error: error.message }; }
});
ipcMain.handle('cli:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'arduino-cli 실행 파일 선택',
    properties: ['openFile'],
    filters: [{ name: 'arduino-cli', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }]
  });
  if (result.canceled) return null;
  return saveSettings({ cliPath: result.filePaths[0] });
});
ipcMain.handle('cli:check', () => runCli(['version']));
ipcMain.handle('ports:list', async () => {
  if (process.platform !== 'win32') return { ok: false, ports: [], error: '현재 데모는 Windows만 지원합니다.' };
  return new Promise((resolve) => {
    const script = '[System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object | ConvertTo-Json -Compress';
    execFile('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true }, (error, stdout) => {
      if (error) return resolve({ ok: false, ports: [], error: error.message });
      try {
        const parsed = stdout.trim() ? JSON.parse(stdout.trim()) : [];
        const names = Array.isArray(parsed) ? parsed : [parsed];
        resolve({ ok: true, ports: names.map((portName) => ({ path: portName, label: 'USB 시리얼 포트' })) });
      } catch (parseError) { resolve({ ok: false, ports: [], error: parseError.message }); }
    });
  });
});

async function buildSketch(payload) {
  if (!payload || typeof payload.code !== 'string' || payload.code.length > 500000) {
    return { ok: false, stderr: '생성 코드가 올바르지 않습니다.' };
  }
  const fqbn = payload.fqbn || readSettings().fqbn || 'arduino:avr:uno';
  const cacheKey = crypto.createHash('sha256').update(`${fqbn}\0${payload.code}`).digest('hex').slice(0, 24);
  const root = path.join(app.getPath('userData'), 'arduino-build-cache', cacheKey);
  // 스케치 폴더와 빌드 작업 폴더를 보드별로 고정해 재사용한다. arduino-cli는 스케치 위치가 바뀌면
  // 빌드 폴더를 통째로 지우므로, 둘 다 고정해야 Servo 라이브러리 등 이미 컴파일된 오브젝트가 재사용된다.
  const fqbnKey = crypto.createHash('sha256').update(fqbn).digest('hex').slice(0, 12);
  const workRoot = path.join(app.getPath('userData'), 'arduino-build-cache', `work-${fqbnKey}`);
  const sketchDir = path.join(workRoot, 'ArmBlocksSketch');
  const buildWorkDir = path.join(workRoot, 'build');
  const buildDir = path.join(root, 'output');
  const markerPath = path.join(buildDir, '.armblocks-complete');
  fs.mkdirSync(sketchDir, { recursive: true });
  fs.mkdirSync(buildWorkDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(sketchDir, 'ArmBlocksSketch.ino'), payload.code, 'utf8');
  if (fs.existsSync(markerPath)) {
    return { ok: true, cached: true, stdout: '변경되지 않은 컴파일 결과를 재사용했습니다.\n', stderr: '', sketchDir, buildDir, cacheKey };
  }
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });
  const args = ['compile', '--fqbn', fqbn, '--build-path', buildWorkDir, '--output-dir', buildDir, sketchDir];
  const sendLog = payload.background
    ? () => {}
    : (text, stream) => mainWindow?.webContents.send('build:log', { text, stream });
  let result = await runCli(args, sendLog);
  if (!result.ok && /unable to rename[\s\S]*core\.a[\s\S]*(file exists|reason)/i.test(result.stderr)) {
    sendLog('이전 컴파일 충돌 파일을 정리하고 한 번 다시 시도합니다.\n', 'stderr');
    fs.rmSync(buildWorkDir, { recursive: true, force: true });
    fs.mkdirSync(buildWorkDir, { recursive: true });
    result = await runCli(args, sendLog);
  }
  if (result.ok) fs.writeFileSync(markerPath, JSON.stringify({ fqbn, cacheKey, builtAt: new Date().toISOString() }), 'utf8');
  return { ...result, sketchDir, buildDir, cacheKey };
}

ipcMain.handle('sketch:build', async (_event, payload) => {
  const requestedKey = crypto.createHash('sha256')
    .update(`${payload?.fqbn || ''}\0${payload?.code || ''}`)
    .digest('hex');
  while (activeBuildPromise) {
    if (activeBuildKey === requestedKey) return activeBuildPromise;
    await activeBuildPromise;
  }
  activeBuildKey = requestedKey;
  activeBuildPromise = buildSketch(payload);
  try { return await activeBuildPromise; }
  finally { activeBuildPromise = null; activeBuildKey = ''; }
});

ipcMain.handle('sketch:upload', async (_event, payload) => {
  if (!payload?.port || !/^[A-Za-z0-9_./:\\-]+$/.test(payload.port)) return { ok: false, stderr: '포트를 확인하세요.' };
  if (!payload?.sketchDir || !fs.existsSync(payload.sketchDir)) return { ok: false, stderr: '먼저 컴파일하세요.' };
  if (!payload?.buildDir || !fs.existsSync(payload.buildDir)) return { ok: false, stderr: '컴파일 결과를 찾을 수 없습니다.' };
  const settings = readSettings();
  const fqbn = payload.fqbn || settings.fqbn || 'arduino:avr:uno';
  const sendLog = (text, stream) => mainWindow?.webContents.send('build:log', { text, stream });

  // Uno는 avrdude에 COM 포트를 직접 넘긴다. Arduino CLI의 discovery 재검색은 이미 표시된 COM 포트도
  // 간헐적으로 놓쳐 "Error getting port metadata: port not found"를 내므로 USB 업로드에는 사용하지 않는다.
  if (process.platform === 'win32' && fqbn === 'arduino:avr:uno' && /^COM\d+$/i.test(payload.port)) {
    let arduinoRoot;
    try { arduinoRoot = await ensureArduinoRuntime(sendLog); }
    catch (error) { return { ok: false, code: -1, stdout: '', stderr: `Arduino 도구 준비 실패: ${error.message}` }; }
    const avrdude = resolveAvrdude(arduinoRoot);
    const hexFile = fs.readdirSync(payload.buildDir)
      .find((fileName) => fileName.toLowerCase().endsWith('.ino.hex') && !fileName.toLowerCase().includes('with_bootloader'));
    if (!avrdude) return { ok: false, code: -1, stdout: '', stderr: '내장 avrdude 업로드 도구를 찾을 수 없습니다.' };
    if (!hexFile) return { ok: false, code: -1, stdout: '', stderr: '컴파일된 HEX 파일을 찾을 수 없습니다. 다시 컴파일하세요.' };
    sendLog(`${payload.port}에 직접 업로드합니다.\n`, 'stdout');
    return runExecutable(avrdude.executable, [
      `-C${avrdude.config}`,
      '-patmega328p',
      '-carduino',
      `-P${payload.port.toUpperCase()}`,
      '-b115200',
      '-D',
      `-Uflash:w:${path.join(payload.buildDir, hexFile)}:i`
    ], sendLog);
  }

  const args = ['upload', '-p', payload.port, '--discovery-timeout', '3s', '--fqbn', fqbn, '--input-dir', payload.buildDir, payload.sketchDir];
  return runCli(args, sendLog);
});

ipcMain.handle('serial:connect', async (_event, portPath) => {
  if (process.platform !== 'win32' || !/^COM\d+$/i.test(portPath)) return { ok: false, error: '올바른 Windows COM 포트가 아닙니다.' };
  try {
    await closeMonitor();
    const OPEN_MARKER = '__ARMBLOCKS_OPEN__';
    // [Console]::In.ReadLineAsync()는 Windows PowerShell(.NET Framework)에서 실제로는 동기 호출이라
    // 입력이 올 때까지 루프 전체가 멈춰 보드 출력이 보이지 않았다. 표준입력 스트림의 ReadAsync를 쓴다.
    const script = [
      "$ErrorActionPreference = 'Stop'",
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      '$port = [System.IO.Ports.SerialPort]::new($env:ARMBLOCKS_PORT, 115200)',
      '$port.Encoding = [System.Text.Encoding]::UTF8',
      '$port.ReadTimeout = 50',
      '$port.WriteTimeout = 500',
      '$opened = $false',
      // 업로드 직후에는 포트가 잠깐 잠겨 있으므로 최대 약 5초 동안 다시 시도한다.
      'for ($i = 0; $i -lt 20 -and -not $opened; $i++) { try { $port.Open(); $opened = $true } catch { if ($i -eq 19) { throw }; Start-Sleep -Milliseconds 250 } }',
      `[Console]::Out.WriteLine('${OPEN_MARKER}')`,
      '[Console]::Out.Flush()',
      '$stdin = [Console]::OpenStandardInput()',
      '$buffer = New-Object byte[] 1024',
      '$readTask = $stdin.ReadAsync($buffer, 0, $buffer.Length)',
      '$running = $true',
      'while ($running) {',
      '  if ($port.BytesToRead -gt 0) { [Console]::Out.Write($port.ReadExisting()); [Console]::Out.Flush() }',
      '  if ($readTask.IsCompleted) {',
      '    $count = $readTask.Result',
      '    if ($count -le 0) { $running = $false } else { $port.Write($buffer, 0, $count); $readTask = $stdin.ReadAsync($buffer, 0, $buffer.Length) }',
      '  }',
      '  if (-not $port.IsOpen) { $running = $false }',
      '  Start-Sleep -Milliseconds 10',
      '}',
      '$port.Close()'
    ].join('; ');
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      env: { ...process.env, ARMBLOCKS_PORT: portPath }
    });
    monitorProcess = child;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    let opened = false;
    let startupError = '';
    let pending = '';
    const ready = await new Promise((resolve) => {
      // PowerShell 첫 실행은 백신 검사 등으로 수 초 걸릴 수 있어 고정 350ms 대신 열림 신호를 기다린다.
      const timer = setTimeout(() => resolve(false), 12000);
      child.stdout.on('data', (text) => {
        if (!opened) {
          pending += text;
          const index = pending.indexOf(OPEN_MARKER);
          if (index < 0) return;
          opened = true;
          clearTimeout(timer);
          text = pending.slice(index + OPEN_MARKER.length).replace(/^\r?\n/, '');
          pending = '';
          resolve(true);
        }
        if (text) mainWindow?.webContents.send('serial:data', text);
      });
      child.stderr.on('data', (text) => {
        startupError += text;
        if (opened) mainWindow?.webContents.send('serial:data', `\n[오류] ${text}\n`);
      });
      child.on('error', (error) => { startupError += error.message; });
      child.on('close', (code) => {
        clearTimeout(timer);
        // 이미 새 연결로 교체된 경우 새 프로세스 참조를 지우지 않는다.
        if (monitorProcess === child) {
          monitorProcess = null;
          if (opened) mainWindow?.webContents.send('serial:closed', { code, error: startupError ? friendlySerialError(startupError, portPath) : '' });
        }
        resolve(false);
      });
    });
    if (!ready) {
      if (monitorProcess === child) monitorProcess = null;
      try { child.kill(); } catch {}
      return { ok: false, error: startupError ? friendlySerialError(startupError, portPath) : '포트를 여는 데 시간이 너무 오래 걸립니다. USB를 다시 연결해 보세요.' };
    }
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
});
ipcMain.handle('serial:write', async (_event, value) => {
  if (!monitorProcess?.stdin?.writable) return { ok: false, error: '시리얼 연결이 없습니다.' };
  monitorProcess.stdin.write(`${String(value).trimEnd()}\n`);
  return { ok: true };
});
ipcMain.handle('serial:disconnect', async () => {
  await closeMonitor();
  return { ok: true };
});

const uninstallMode = process.argv.includes('--uninstall');
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on('second-instance', (_event, argv) => {
    if (argv.includes('--uninstall')) return createUninstallWindow();
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(() => uninstallMode ? createUninstallWindow() : createWindow());
}
app.on('before-quit', () => { if (monitorProcess) monitorProcess.kill(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
