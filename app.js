import * as Blockly from 'blockly';
import 'blockly/blocks';
import './style.css';

const api = window.robotAPI;

document.querySelector('#app').innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">AB</span><div><strong>ArmBlocks</strong><small>ADA031 CONTROL STUDIO</small></div></div>
      <div class="device-strip"><span class="status-dot" id="deviceDot"></span><select id="portSelect"><option value="">포트를 검색하세요</option></select><button class="icon-button" id="refreshPorts" title="포트 새로고침">↻</button><select id="boardSelect"><option value="arduino:avr:uno">Arduino Uno / Adeept</option></select><button class="button secondary" id="connectButton">시리얼 모니터</button></div>
      <div class="header-actions"><button class="button ghost cli-tool" id="cliButton">Arduino 도구</button><button class="button ghost" id="updateButton">앱 업데이트</button><button class="button ghost panel-toggle" id="panelButton">코드·로그</button><button class="button danger" id="stopButton"><span>■</span> 소프트 정지</button></div>
    </header>
    <section class="notice" id="notice"><span class="notice-icon">!</span><p><strong>처음 움직이기 전:</strong> 팔을 손으로 받치고, 작업 반경을 비운 뒤, 서보 전원은 꺼진 상태에서 업로드하세요.</p><button id="dismissNotice">확인</button></section>
    <main class="workspace-layout">
      <section class="editor-panel"><div class="panel-head"><div><span class="eyebrow">BLOCK PROGRAM</span><h1>동작 만들기 <small id="projectName">자동 저장본</small></h1></div><div class="panel-tools"><button class="text-button" id="openButton">파일 열기</button><button class="text-button" id="saveButton">저장</button><button class="text-button" id="saveAsButton">다른 이름으로</button><span class="tool-divider"></span><button class="text-button" id="exampleButton">예제</button><button class="text-button" id="clearButton">모두 지우기</button></div></div><div id="blocklyDiv"></div></section>
      <aside class="inspector">
        <div class="tabs"><button class="tab active" data-tab="code">생성 코드</button><button class="tab" data-tab="console">콘솔 <span class="log-count" id="logCount">0</span></button><button class="tab" data-tab="hardware">하드웨어</button><button class="inspector-close" id="panelClose" title="패널 닫기">×</button></div>
        <div class="tab-page active" id="tab-code"><div class="code-meta"><span>ArmBlocksSketch.ino</span><button id="copyCode">복사</button></div><pre id="codePreview"></pre></div>
        <div class="tab-page" id="tab-console"><div class="console-actions"><button id="clearLog">로그 지우기</button></div><pre id="consoleOutput">ArmBlocks 준비됨.\n</pre></div>
        <div class="tab-page hardware-page" id="tab-hardware"><div class="hardware-card good"><span>01</span><div><strong>서보 신호</strong><p>D9 · D6 · D5 · D3 · D11</p></div></div><div class="hardware-card"><span>02</span><div><strong>안전 전원</strong><p>정격 확인된 DC 전원, 공통 GND</p></div></div><div class="hardware-card"><span>03</span><div><strong>노브 비상모드</strong><p>기본 OFF · 명시적으로만 활성화</p></div></div><div class="hardware-card warn"><span>!</span><div><strong>물리 비상정지 권장</strong><p>앱 정지는 통신 장애 때 작동하지 않습니다.</p></div></div></div>
      </aside>
    </main>
    <footer class="bottombar"><div class="status-copy"><span id="buildDot"></span><div><strong id="buildTitle">편집 준비</strong><small id="buildDetail">블록을 연결해 프로그램을 만드세요.</small></div></div><div class="emergency-controls"><button class="button secondary" id="knobButton">노브 비상모드 켜기</button><button class="button secondary" id="homeButton">제어 재개</button></div><div class="build-actions"><button class="button secondary large" id="verifyButton">✓ 컴파일</button><button class="button primary large" id="uploadButton">→ 보드에 업로드</button></div></footer>
  </div>`;

Blockly.defineBlocksWithJsonArray([
  { type: 'arm_start', message0: '로봇팔 시작', message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], colour: 18 },
  { type: 'arm_home', message0: '안전 홈 위치로 이동', previousStatement: null, nextStatement: null, colour: 188 },
  { type: 'arm_move', message0: '%1 관절을 %2 °로 이동', args0: [{ type: 'field_dropdown', name: 'SERVO', options: [['베이스','0'],['어깨','1'],['팔꿈치','2'],['손목','3'],['그리퍼','4']] }, { type: 'field_number', name: 'ANGLE', value: 90, min: 0, max: 180, precision: 1 }], previousStatement: null, nextStatement: null, colour: 188 },
  { type: 'arm_pose', message0: '자세 설정  베이스 %1  어깨 %2  팔꿈치 %3  손목 %4  그리퍼 %5', args0: [{ type: 'field_number', name: 'A0', value: 90, min: 0, max: 180 }, { type: 'field_number', name: 'A1', value: 90, min: 0, max: 180 }, { type: 'field_number', name: 'A2', value: 90, min: 0, max: 180 }, { type: 'field_number', name: 'A3', value: 110, min: 90, max: 145 }, { type: 'field_number', name: 'A4', value: 90, min: 0, max: 180 }], previousStatement: null, nextStatement: null, colour: 188 },
  { type: 'arm_speed', message0: '이동 속도 %1 °/초', args0: [{ type: 'field_number', name: 'SPEED', value: 45, min: 5, max: 180 }], previousStatement: null, nextStatement: null, colour: 43 },
  { type: 'arm_wait', message0: '%1 초 기다리기', args0: [{ type: 'field_number', name: 'SECONDS', value: 1, min: 0, max: 60, precision: 0.1 }], previousStatement: null, nextStatement: null, colour: 43 },
  { type: 'arm_repeat', message0: '%1 번 반복', args0: [{ type: 'field_number', name: 'COUNT', value: 2, min: 1, max: 100 }], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], previousStatement: null, nextStatement: null, colour: 292 },
  { type: 'arm_knob', message0: '노브 비상 제어를 %1', args0: [{ type: 'field_dropdown', name: 'MODE', options: [['허용','true'],['차단','false']] }], previousStatement: null, nextStatement: null, colour: 345 },
  { type: 'arm_print', message0: '상태 메시지 %1', args0: [{ type: 'field_input', name: 'TEXT', text: '동작 완료' }], previousStatement: null, nextStatement: null, colour: 120 }
]);

const toolbox = { kind: 'categoryToolbox', contents: [
  { kind: 'category', name: '시작', colour: '#E36542', contents: [{ kind: 'block', type: 'arm_start' }] },
  { kind: 'category', name: '움직임', colour: '#168C89', contents: [{ kind: 'block', type: 'arm_home' }, { kind: 'block', type: 'arm_move' }, { kind: 'block', type: 'arm_pose' }] },
  { kind: 'category', name: '시간 · 속도', colour: '#C98D19', contents: [{ kind: 'block', type: 'arm_speed' }, { kind: 'block', type: 'arm_wait' }] },
  { kind: 'category', name: '제어', colour: '#7558B8', contents: [{ kind: 'block', type: 'arm_repeat' }] },
  { kind: 'category', name: '안전 · 통신', colour: '#B73A62', contents: [{ kind: 'block', type: 'arm_knob' }, { kind: 'block', type: 'arm_print' }] }
] };
const theme = Blockly.Theme.defineTheme('armblocks', { base: Blockly.Themes.Classic, componentStyles: { workspaceBackgroundColour: '#F8F7F3', toolboxBackgroundColour: '#ECE9E1', toolboxForegroundColour: '#3A3934', flyoutBackgroundColour: '#FFFDF8', flyoutForegroundColour: '#333', scrollbarColour: '#C7C2B7', insertionMarkerColour: '#E36542', insertionMarkerOpacity: 0.35, cursorColour: '#168C89' }, fontStyle: { family: 'Noto Sans KR, Segoe UI, sans-serif', weight: '600', size: 12 } });
const workspace = Blockly.inject('blocklyDiv', { toolbox, theme, renderer: 'zelos', trashcan: true, grid: { spacing: 24, length: 2, colour: '#DEDAD0', snap: true }, zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.4, minScale: 0.55 } });

function escapeCpp(value) { return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n'); }

function blocksToCode(first, indent = '  ') {
  let code = '';
  for (let block = first; block; block = block.getNextBlock()) {
    switch (block.type) {
      case 'arm_home': code += `${indent}movePose(90, 90, 90, 110, 90);\n`; break;
      case 'arm_move': code += `${indent}moveServoSafe(${block.getFieldValue('SERVO')}, ${block.getFieldValue('ANGLE')});\n`; break;
      case 'arm_pose': code += `${indent}movePose(${[0,1,2,3,4].map((n) => block.getFieldValue(`A${n}`)).join(', ')});\n`; break;
      case 'arm_speed': code += `${indent}degreesPerSecond = ${block.getFieldValue('SPEED')};\n`; break;
      case 'arm_wait': code += `${indent}safeDelay(${Math.round(Number(block.getFieldValue('SECONDS')) * 1000)}UL);\n`; break;
      case 'arm_knob': code += `${indent}knobMode = ${block.getFieldValue('MODE')};\n`; break;
      case 'arm_print': code += `${indent}Serial.println("${escapeCpp(block.getFieldValue('TEXT'))}");\n`; break;
      case 'arm_repeat':
        code += `${indent}for (int repeatIndex = 0; repeatIndex < ${block.getFieldValue('COUNT')} && !stopped; ++repeatIndex) {\n`;
        code += blocksToCode(block.getInputTargetBlock('DO'), `${indent}  `);
        code += `${indent}}\n`;
        break;
    }
    code += `${indent}serviceSerial(); if (stopped) return;\n`;
  }
  return code;
}

function generateSketch() {
  const starts = workspace.getTopBlocks(true).filter((block) => block.type === 'arm_start');
  const body = starts.length ? starts.map((block) => blocksToCode(block.getInputTargetBlock('DO'))).join('') : '  // 시작 블록을 추가하세요.\n';
  return `// ArmBlocks Studio generated code — Adeept ADA031 / Arduino Uno
#include <Servo.h>

const byte SERVO_COUNT = 5;
const byte SERVO_PINS[SERVO_COUNT] = {9, 6, 5, 3, 11};
const int SERVO_MIN[SERVO_COUNT] = {0, 0, 0, 90, 0};
const int SERVO_MAX[SERVO_COUNT] = {180, 180, 180, 145, 180};
const byte KNOB_PINS[4] = {A0, A1, A2, A3};
Servo servos[SERVO_COUNT];
int currentAngle[SERVO_COUNT] = {90, 90, 90, 110, 90};
int degreesPerSecond = 45;
bool stopped = false;
bool knobMode = false; // 마지막 수단: 시리얼 명령 KNOB ON으로만 활성화
bool knobArmed[4] = {false, false, false, false};

void attachAll() {
  for (byte i = 0; i < SERVO_COUNT; ++i) {
    if (!servos[i].attached()) servos[i].attach(SERVO_PINS[i]);
    servos[i].write(currentAngle[i]);
  }
}

void detachAll() {
  for (byte i = 0; i < SERVO_COUNT; ++i) servos[i].detach();
}

void serviceSerial() {
  if (!Serial.available()) return;
  String command = Serial.readStringUntil('\\n');
  command.trim(); command.toUpperCase();
  if (command == "STOP") { stopped = true; knobMode = false; detachAll(); Serial.println("STOPPED"); }
  else if (command == "RUN") { stopped = false; attachAll(); Serial.println("RUNNING"); }
  else if (command == "KNOB ON") {
    stopped = false; knobMode = true; attachAll();
    for (byte i = 0; i < 4; ++i) knobArmed[i] = false;
    Serial.println("KNOB MODE ON — align each knob before it takes control");
  }
  else if (command == "KNOB OFF") { knobMode = false; Serial.println("KNOB MODE OFF"); }
}

void safeDelay(unsigned long duration) {
  unsigned long started = millis();
  while (millis() - started < duration && !stopped) { serviceSerial(); delay(5); }
}

void moveServoSafe(byte index, int target) {
  if (index >= SERVO_COUNT || stopped) return;
  target = constrain(target, SERVO_MIN[index], SERVO_MAX[index]);
  int stepDirection = target >= currentAngle[index] ? 1 : -1;
  unsigned long stepDelay = max(6UL, 1000UL / (unsigned long)max(1, degreesPerSecond));
  while (currentAngle[index] != target && !stopped) {
    currentAngle[index] += stepDirection;
    servos[index].write(currentAngle[index]);
    safeDelay(stepDelay);
  }
}

void movePose(int a0, int a1, int a2, int a3, int a4) {
  int target[5] = {a0, a1, a2, a3, a4};
  for (byte i = 0; i < SERVO_COUNT && !stopped; ++i) moveServoSafe(i, target[i]);
}

void serviceKnobs() {
  if (!knobMode || stopped) return;
  for (byte i = 0; i < 4; ++i) {
    int target = map(analogRead(KNOB_PINS[i]), 0, 1023, SERVO_MIN[i], SERVO_MAX[i]);
    if (!knobArmed[i]) {
      if (abs(target - currentAngle[i]) <= 6) knobArmed[i] = true;
      continue;
    }
    if (abs(target - currentAngle[i]) >= 3) moveServoSafe(i, target);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(20);
  attachAll();
  Serial.println("ARMBLOCKS READY — knob mode is OFF");
}

void loop() {
  serviceSerial();
  serviceKnobs();
  if (stopped || knobMode) { delay(10); return; }
${body}}
`;
}

const codePreview = document.querySelector('#codePreview');
let currentProjectPath = '';
let projectDirty = false;
let backgroundCompileReady = false;
function refreshCode() {
  codePreview.textContent = generateSketch();
  try { localStorage.setItem('armblocks-workspace', JSON.stringify(Blockly.serialization.workspaces.save(workspace))); } catch {}
}
workspace.addChangeListener((event) => {
  if (!event.isUiEvent) {
    projectDirty = true;
    displayProjectName();
    refreshCode();
    if (backgroundCompileReady) scheduleBackgroundCompile();
  }
});

function loadExample() {
  workspace.clear();
  const state = { blocks: { languageVersion: 0, blocks: [{ type: 'arm_start', x: 42, y: 48, inputs: { DO: { block: { type: 'arm_speed', fields: { SPEED: 35 }, next: { block: { type: 'arm_home', next: { block: { type: 'arm_move', fields: { SERVO: '4', ANGLE: 35 }, next: { block: { type: 'arm_wait', fields: { SECONDS: 1 }, next: { block: { type: 'arm_move', fields: { SERVO: '4', ANGLE: 90 }, next: { block: { type: 'arm_print', fields: { TEXT: '집기 동작 완료' } } } } } } } } } } } } } } }] } };
  Blockly.serialization.workspaces.load(state, workspace);
  refreshCode();
}

try {
  const saved = localStorage.getItem('armblocks-workspace');
  if (saved) Blockly.serialization.workspaces.load(JSON.parse(saved), workspace); else loadExample();
} catch { loadExample(); }

let compiledSketchDir = '';
let compiledBuildDir = '';
let compiledSource = '';
let compiledFqbn = '';
let compilePromise = null;
let backgroundCompileTimer = null;
let backgroundCompileSerial = 0;
let connected = false;
let portRefreshInFlight = false;
let lastKnownPort = '';
let portMissingScans = 0;
let availablePortPaths = new Set();
let knobEnabled = false;
let logLines = 0;
const consoleOutput = document.querySelector('#consoleOutput');

function projectDocument() {
  return {
    format: 'armblocks-project',
    version: 1,
    savedAt: new Date().toISOString(),
    target: { fqbn: document.querySelector('#boardSelect').value, robot: 'Adeept ADA031-V4.0' },
    workspace: Blockly.serialization.workspaces.save(workspace)
  };
}
function datedProjectName() {
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('_');
  const counterKey = `armblocks-save-counter-${date}`;
  const sequence = Math.max(1, Number(localStorage.getItem(counterKey) || 1));
  return { name: `${date}_${sequence}.armblocks`, counterKey, sequence };
}
function displayProjectName() {
  const label = currentProjectPath ? currentProjectPath.split(/[\\/]/).pop() : '자동 저장본';
  document.querySelector('#projectName').textContent = `${label}${projectDirty ? ' •' : ''}`;
}
async function saveProject(saveAs = false) {
  const defaultName = datedProjectName();
  const usesDatedName = !currentProjectPath || saveAs;
  const result = await api.saveProject({
    filePath: currentProjectPath,
    saveAs,
    suggestedName: usesDatedName ? defaultName.name : currentProjectPath.split(/[\\/]/).pop(),
    content: JSON.stringify(projectDocument(), null, 2)
  });
  if (!result) return;
  if (!result.ok) return setStatus('저장 실패', result.error, 'error');
  currentProjectPath = result.filePath;
  if (usesDatedName) localStorage.setItem(defaultName.counterKey, String(defaultName.sequence + 1));
  projectDirty = false;
  displayProjectName();
  setStatus('프로젝트 저장됨', currentProjectPath, 'success');
}
async function openProject() {
  const result = await api.openProject();
  if (!result) return;
  if (!result.ok) return setStatus('열기 실패', result.error, 'error');
  try {
    const documentData = JSON.parse(result.content);
    if (documentData.format !== 'armblocks-project' || !documentData.workspace) throw new Error('ArmBlocks 프로젝트 형식이 아닙니다.');
    workspace.clear();
    Blockly.serialization.workspaces.load(documentData.workspace, workspace);
    if (documentData.target?.fqbn) document.querySelector('#boardSelect').value = documentData.target.fqbn;
    currentProjectPath = result.filePath;
    projectDirty = false;
    displayProjectName();
    refreshCode();
    setStatus('프로젝트 열림', currentProjectPath, 'success');
  } catch (error) { setStatus('파일 형식 오류', error.message, 'error'); }
}

function appendLog(text, type = '') {
  consoleOutput.textContent += text;
  consoleOutput.classList.toggle('has-error', type === 'stderr');
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
  logLines += String(text).split('\n').length - 1;
  document.querySelector('#logCount').textContent = logLines;
}
function setStatus(title, detail, state = '') {
  document.querySelector('#buildTitle').textContent = title;
  document.querySelector('#buildDetail').textContent = detail;
  document.querySelector('#buildDot').className = state;
}
async function refreshPorts() {
  if (portRefreshInFlight) return;
  portRefreshInFlight = true;
  const select = document.querySelector('#portSelect');
  const previous = select.value || lastKnownPort;
  try {
    const result = await api.listPorts();
    const ports = result.ports || [];
    availablePortPaths = new Set(ports.map((port) => port.path));
    select.replaceChildren();
    for (const port of ports) {
      const option = document.createElement('option');
      option.value = port.path;
      option.textContent = `${port.path}${port.label ? ` — ${port.label}` : ''}`;
      select.append(option);
    }

    if (previous && !availablePortPaths.has(previous) && portMissingScans < 4) {
      portMissingScans += 1;
      const waiting = document.createElement('option');
      waiting.value = previous;
      waiting.textContent = `${previous} — 재연결 기다리는 중…`;
      select.prepend(waiting);
      select.value = previous;
    } else if (ports.length) {
      portMissingScans = 0;
      if (availablePortPaths.has(previous)) select.value = previous;
      lastKnownPort = select.value;
    } else {
      portMissingScans = Math.min(portMissingScans + 1, 5);
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '연결된 포트 없음';
      select.append(option);
    }

    const available = availablePortPaths.has(select.value);
    document.querySelector('#deviceDot').classList.toggle('ready', available);
    document.querySelector('#deviceDot').classList.toggle('waiting', Boolean(select.value) && !available);
  } finally {
    portRefreshInFlight = false;
  }
}
async function compileOnce() {
  const code = generateSketch();
  const fqbn = document.querySelector('#boardSelect').value;
  if (compiledSketchDir && compiledBuildDir && compiledSource === code && compiledFqbn === fqbn) {
    setStatus('컴파일 결과 재사용', '코드가 변경되지 않아 바로 업로드할 수 있습니다.', 'success');
    appendLog('↻ 변경되지 않은 컴파일 결과 재사용\n');
    return true;
  }
  setStatus('컴파일 중…', 'Arduino 스케치를 검사하고 있습니다.', 'working');
  appendLog('\n▶ 컴파일 시작\n');
  const result = await api.build({ code, fqbn });
  if (result.ok) {
    compiledSketchDir = result.sketchDir;
    compiledBuildDir = result.buildDir;
    compiledSource = code;
    compiledFqbn = fqbn;
    setStatus(result.cached ? '컴파일 결과 재사용' : '컴파일 성공', result.cached ? '저장된 바이너리를 바로 사용합니다.' : '오류 없이 보드에 올릴 준비가 됐습니다.', 'success');
    appendLog(result.cached ? '↻ 저장된 컴파일 결과 재사용\n' : '✓ 컴파일 성공\n');
  } else {
    compiledSketchDir = '';
    compiledBuildDir = '';
    compiledSource = '';
    compiledFqbn = '';
    setStatus('컴파일 실패', result.stderr || '도구 설정을 확인하세요.', 'error');
    if (result.stderr) appendLog(`${result.stderr}\n`, 'stderr');
  }
  return result.ok;
}

async function compile() {
  if (compilePromise) return compilePromise;
  const verifyButton = document.querySelector('#verifyButton');
  const uploadButton = document.querySelector('#uploadButton');
  verifyButton.disabled = true;
  uploadButton.disabled = true;
  compilePromise = compileOnce();
  try { return await compilePromise; }
  finally {
    compilePromise = null;
    verifyButton.disabled = false;
    uploadButton.disabled = false;
  }
}

function scheduleBackgroundCompile(delay = 1400) {
  clearTimeout(backgroundCompileTimer);
  const serial = ++backgroundCompileSerial;
  backgroundCompileTimer = setTimeout(async () => {
    const code = generateSketch();
    const fqbn = document.querySelector('#boardSelect').value;
    const result = await api.build({ code, fqbn, background: true });
    if (serial !== backgroundCompileSerial || code !== generateSketch() || fqbn !== document.querySelector('#boardSelect').value) return;
    if (result.ok) {
      compiledSketchDir = result.sketchDir;
      compiledBuildDir = result.buildDir;
      compiledSource = code;
      compiledFqbn = fqbn;
    }
  }, delay);
}

backgroundCompileReady = true;

document.querySelector('#verifyButton').addEventListener('click', compile);
document.querySelector('#uploadButton').addEventListener('click', async () => {
  const port = document.querySelector('#portSelect').value;
  if (!port) return setStatus('포트가 필요합니다', 'USB 케이블을 연결하고 포트를 새로고침하세요.', 'error');
  if (!availablePortPaths.has(port)) return setStatus('포트 재연결 중', `${port}가 다시 나타날 때까지 잠시 기다리세요.`, 'working');
  if (connected) { await api.serialDisconnect(); connected = false; document.querySelector('#connectButton').textContent = '시리얼 모니터'; }
  if (!await compile()) return;
  setStatus('업로드 중…', `${port}에 프로그램을 전송하고 있습니다.`, 'working');
  appendLog(`\n▶ ${port} 업로드 시작\n`);
  const result = await api.upload({ sketchDir: compiledSketchDir, buildDir: compiledBuildDir, port, fqbn: document.querySelector('#boardSelect').value });
  if (result.ok) { setStatus('업로드 완료', '서보 전원을 켜기 전 작업 반경을 확인하세요.', 'success'); appendLog('✓ 업로드 완료\n'); }
  else { setStatus('업로드 실패', result.stderr || '포트와 보드를 확인하세요.', 'error'); appendLog(`${result.stderr || '업로드 실패'}\n`, 'stderr'); }
});

document.querySelector('#refreshPorts').addEventListener('click', () => refreshPorts());
document.querySelector('#portSelect').addEventListener('change', (event) => {
  if (availablePortPaths.has(event.currentTarget.value)) lastKnownPort = event.currentTarget.value;
});
document.querySelector('#updateButton').addEventListener('click', async () => {
  setStatus('업데이트 파일 선택', '새 버전의 ArmBlocks Studio 설치 파일을 선택하세요.', 'working');
  const result = await api.installUpdate();
  if (!result) return setStatus('업데이트 취소', '현재 버전을 계속 사용합니다.');
  if (!result.ok) return setStatus('업데이트 불가', result.error, 'error');
  setStatus('업데이트 시작', `${result.version} 설치 프로그램을 실행합니다.`, 'success');
});
document.querySelector('#connectButton').addEventListener('click', async (event) => {
  if (connected) { await api.serialDisconnect(); connected = false; event.currentTarget.textContent = '시리얼 모니터'; return; }
  const port = document.querySelector('#portSelect').value;
  if (!port) return;
  if (!availablePortPaths.has(port)) return setStatus('포트 재연결 중', `${port}가 다시 나타날 때까지 잠시 기다리세요.`, 'working');
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = '연결 중…';
  setStatus('시리얼 연결 중…', `${port}를 여는 중입니다.`, 'working');
  const result = await api.serialConnect(port);
  button.disabled = false;
  connected = result.ok;
  button.textContent = result.ok ? '연결 해제' : '시리얼 모니터';
  setStatus(result.ok ? '시리얼 연결됨' : '연결 실패', result.ok ? `${port} · 115200 baud` : result.error, result.ok ? 'success' : 'error');
});
document.querySelector('#stopButton').addEventListener('click', async () => {
  if (!connected) return setStatus('소프트 정지 불가', '먼저 시리얼 모니터를 연결하세요. 물리 전원 스위치를 우선 사용하세요.', 'error');
  await api.serialWrite('STOP\n'); knobEnabled = false; document.querySelector('#knobButton').textContent = '노브 비상모드 켜기';
  setStatus('정지 명령 전송', '서보 신호를 해제했습니다. 팔이 낙하할 수 있으니 받쳐 주세요.', 'error');
});
document.querySelector('#homeButton').addEventListener('click', async () => {
  if (!connected) return setStatus('연결 필요', '제어 재개는 시리얼 연결 후 사용할 수 있습니다.', 'error');
  await api.serialWrite('RUN\n'); setStatus('제어 재개', '블록 프로그램을 다시 실행합니다.', 'success');
});
document.querySelector('#knobButton').addEventListener('click', async (event) => {
  if (!connected) return setStatus('연결 필요', '노브 비상모드는 시리얼 연결 후에만 켤 수 있습니다.', 'error');
  knobEnabled = !knobEnabled;
  await api.serialWrite(knobEnabled ? 'KNOB ON\n' : 'KNOB OFF\n');
  event.currentTarget.textContent = knobEnabled ? '노브 비상모드 끄기' : '노브 비상모드 켜기';
  event.currentTarget.classList.toggle('warn', knobEnabled);
  setStatus(knobEnabled ? '노브 비상모드' : '노브 차단됨', knobEnabled ? '천천히 한 개씩 조작하세요.' : '블록 프로그램 제어로 돌아갑니다.', knobEnabled ? 'working' : 'success');
});
document.querySelector('#cliButton').addEventListener('click', async () => {
  const check = await api.checkCli();
  setStatus(check.ok ? '내장 Arduino 도구 준비됨' : '내장 도구 확인 실패', check.ok ? check.stdout.trim() : check.stderr, check.ok ? 'success' : 'error');
});
document.querySelector('#copyCode').addEventListener('click', async () => { await navigator.clipboard.writeText(generateSketch()); setStatus('코드 복사됨', '클립보드에 Arduino 스케치를 복사했습니다.', 'success'); });
document.querySelector('#openButton').addEventListener('click', openProject);
document.querySelector('#saveButton').addEventListener('click', () => saveProject(false));
document.querySelector('#saveAsButton').addEventListener('click', () => saveProject(true));
document.querySelector('#exampleButton').addEventListener('click', loadExample);
document.querySelector('#clearButton').addEventListener('click', () => { workspace.clear(); refreshCode(); });
document.querySelector('#clearLog').addEventListener('click', () => { consoleOutput.textContent = ''; logLines = 0; document.querySelector('#logCount').textContent = '0'; });
document.querySelector('#dismissNotice').addEventListener('click', () => document.querySelector('#notice').classList.add('hidden'));
function toggleInspector(force) {
  const inspector = document.querySelector('.inspector');
  const shouldOpen = typeof force === 'boolean' ? force : !inspector.classList.contains('open');
  inspector.classList.toggle('open', shouldOpen);
  document.querySelector('#panelButton').classList.toggle('active', shouldOpen);
  document.querySelector('#panelButton').textContent = shouldOpen ? '코드·로그 닫기' : '코드·로그';
  setTimeout(() => Blockly.svgResize(workspace), 240);
}
document.querySelector('#panelButton').addEventListener('click', () => toggleInspector());
document.querySelector('#panelClose').addEventListener('click', () => toggleInspector(false));
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab,.tab-page').forEach((item) => item.classList.remove('active'));
  tab.classList.add('active'); document.querySelector(`#tab-${tab.dataset.tab}`).classList.add('active');
}));

api.onBuildLog(({ text, stream }) => appendLog(text, stream));
api.onSerialData((text) => appendLog(text));
api.onSerialClosed?.((info) => {
  if (!connected) return;
  connected = false;
  document.querySelector('#connectButton').textContent = '시리얼 모니터';
  setStatus('시리얼 연결 끊김', info?.error || 'USB 연결을 확인하고 다시 연결하세요.', 'error');
});
window.addEventListener('resize', () => Blockly.svgResize(workspace));
window.addEventListener('keydown', (event) => {
  if (!event.ctrlKey) return;
  if (event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(event.shiftKey); }
  if (event.key.toLowerCase() === 'o') { event.preventDefault(); openProject(); }
});
displayProjectName();
refreshCode();
refreshPorts();
setInterval(refreshPorts, 2000);
scheduleBackgroundCompile(350);
