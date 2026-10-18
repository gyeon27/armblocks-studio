# ArmBlocks Studio

Adeept ADA031-V4.0 5축 로봇팔을 위한 한국어 블록코딩 데스크톱 앱입니다. 블록을 조립하면 Arduino C++ 코드를 생성하고, Arduino Uno 호환 보드로 컴파일·업로드할 수 있습니다.

## 실행

```powershell
npm install
npm run dev
```

프로덕션 빌드는 `npm run build`, Windows 설치 프로그램은 `npm run dist`를 사용합니다. 설치 파일은 `ArmBlocks-Studio-Setup-버전.exe` 이름으로 생성됩니다.

배포용 설치 프로그램에는 Arduino CLI, Arduino AVR 코어, AVR-GCC, avrdude, ArduinoOTA, Servo 라이브러리가 포함됩니다. 별도 Arduino IDE나 인터넷 연결 없이 Uno 호환 보드를 컴파일하고 업로드하도록 구성되어 있습니다.

## 포함 기능

- Blockly 기반 관절 이동, 전체 자세, 속도, 대기, 반복 블록
- 공식 예제와 같은 서보 신호 핀: D9, D6, D5, D3, D11
- COM 포트 검색, Arduino Uno 대상 컴파일 및 업로드
- 115200 baud 시리얼 모니터
- 소프트 정지(`STOP`)와 제어 재개(`RUN`)
- 평상시 차단되는 노브 비상모드(`KNOB ON` / `KNOB OFF`)
- 노브 활성화 시 현재 각도와 노브가 가까워져야 제어권을 넘기는 무충격 전환
- 프로젝트 자동 저장 및 Arduino 코드 미리보기
- `.armblocks` 프로젝트 파일 열기, 저장, 다른 이름으로 저장 (`Ctrl+O`, `Ctrl+S`)

작업 중인 블록은 브라우저 저장소에도 자동 저장되어 앱을 다시 열면 복구됩니다. 과제별 보관이나 다른 PC로 이동할 때는 상단의 **저장**을 사용해 `.armblocks` 파일로 내보내세요. 이 파일은 블록 배치, 보드 종류, 형식 버전이 담긴 JSON 문서입니다.

> 소프트 정지는 물리적인 비상정지 스위치를 대신하지 않습니다. 통신 단절이나 MCU 정지 상황에서는 동작하지 않습니다.

## 안전한 첫 시험

1. 서보 전원을 끄고 USB만 연결합니다.
2. 앱에서 포트와 `Arduino Uno / Adeept`를 선택해 업로드합니다.
3. 팔을 손으로 받치고 관절이 기구 한계에 닿지 않았는지 확인합니다.
4. 전류 제한을 낮게 설정한 외부 전원을 켭니다.
5. 한 관절씩 작은 각도로 시험한 뒤 전체 동작을 실행합니다.

상세 전원·강성·노브 개조안은 [HARDWARE_GUIDE.md](./HARDWARE_GUIDE.md)를 확인하세요.

## 소스 저장소와 배포 파일

이 저장소에는 앱 소스와 빌드 스크립트를 보관합니다. `node_modules`, 빌드 결과, EXE, 로컬 프로젝트 파일, `vendor`의 외부 도구는 Git에 포함하지 않습니다. 저장소를 복제한 뒤 `npm ci`로 JavaScript 의존성을 설치하고 `npm run dev`로 편집 화면을 실행할 수 있습니다.

Arduino 컴파일과 오프라인 배포 EXE 생성에는 별도 런타임 준비가 필요합니다. 기존 배포 환경의 `vendor/arduino-runtime`을 같은 위치에 준비해야 하며, Arduino CLI 실행 파일과 `data`, `user` 폴더에 AVR 코어·컴파일러·업로더·Servo 라이브러리가 있어야 합니다. 소스만 복제한 상태에는 이 도구들이 들어 있지 않습니다. IExpress 설치 스크립트는 `node_modules/electron-winstaller/vendor`의 7-Zip 실행 파일과 DLL도 참조합니다.

현재 개발 스냅샷의 `package.json` 버전은 0.1.7이지만, 일부 설치 스크립트와 출력 경로에는 0.1.6이 남아 있습니다. 새 배포물을 만들기 전 버전과 출력 경로를 맞춰야 합니다. 소스 공개 자체가 새 버전 EXE의 배포를 의미하지는 않습니다.

## 라이선스

현재 앱 소스의 권리는 [LICENSE](./LICENSE)에 따릅니다. 공개 저장소이지만 오픈소스 재사용 라이선스가 부여된 것은 아닙니다. Blockly, Electron, Arduino 도구 등 외부 구성요소에는 각각의 라이선스가 적용됩니다.

