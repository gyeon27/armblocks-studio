const path = require('node:path');
const fs = require('node:fs');
const { createWindowsInstaller } = require('electron-winstaller');

const root = __dirname;
const version = require('./package.json').version;
const appDirectory = path.join(root, `release-${version}`, 'win-unpacked');
const outputDirectory = path.join(root, `release-${version}`, 'installer');

if (!fs.existsSync(path.join(appDirectory, 'ArmBlocks Studio.exe'))) {
  throw new Error('dist/win-unpacked 앱이 없습니다. 먼저 npm run dist 또는 electron-builder --dir을 실행하세요.');
}
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(appDirectory, 'LICENSE'));
fs.rmSync(outputDirectory, { recursive: true, force: true });

createWindowsInstaller({
  appDirectory,
  outputDirectory,
  authors: 'School Robotics Team',
  exe: 'ArmBlocks Studio.exe',
  setupExe: `ArmBlocks-Studio-Setup-${version}.exe`,
  title: 'ArmBlocks Studio',
  description: 'Adeept ADA031 robot arm block coding studio',
  noMsi: true,
  loadingGif: undefined
}).then(() => {
  const installer = path.join(outputDirectory, `ArmBlocks-Studio-Setup-${version}.exe`);
  if (!fs.existsSync(installer)) throw new Error('설치 파일이 생성되지 않았습니다.');
  console.log(installer);
}).catch((error) => {
  // 일부 학교 PC의 보안 정책은 마지막 rcedit 메타데이터 변경을 막는다.
  // 이 시점에는 전체 nupkg와 RELEASES가 이미 완성되어 있으므로,
  // build-demo-installer.ps1가 원본 Squirrel Setup에 직접 삽입한다.
  const releaseFilesReady = fs.existsSync(outputDirectory)
    && fs.readdirSync(outputDirectory).some((name) => name.endsWith('-full.nupkg'))
    && fs.existsSync(path.join(outputDirectory, 'RELEASES'));
  if (!releaseFilesReady) {
    console.error(error);
    process.exitCode = 1;
    return;
  }
  console.warn('설치 파일 메타데이터 단계를 건너뛰고 패키지 삽입 단계로 계속합니다.');
});
