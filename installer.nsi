Unicode true
!include "MUI2.nsh"

!define PRODUCT_NAME "ArmBlocks Studio"
!define PRODUCT_VERSION "0.1.6"
!define PRODUCT_PUBLISHER "School Robotics Team"
!define PRODUCT_EXE "ArmBlocks Studio.exe"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArmBlocksStudio"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "dist\ArmBlocks-Studio-Setup-${PRODUCT_VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\ArmBlocks Studio"
InstallDirRegKey HKCU "Software\ArmBlocksStudio" "InstallLocation"
RequestExecutionLevel user
SetCompressor zlib
ShowInstDetails show
ShowUninstDetails show

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "ArmBlocks Studio 실행"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Korean"
!insertmacro MUI_LANGUAGE "English"

Section "ArmBlocks Studio" SEC_MAIN
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "dist\win-unpacked\*.*"
  WriteUninstaller "$INSTDIR\Uninstall ArmBlocks Studio.exe"

  CreateDirectory "$SMPROGRAMS\ArmBlocks Studio"
  CreateShortcut "$SMPROGRAMS\ArmBlocks Studio\ArmBlocks Studio.lnk" "$INSTDIR\${PRODUCT_EXE}"
  CreateShortcut "$SMPROGRAMS\ArmBlocks Studio\ArmBlocks Studio 제거.lnk" "$INSTDIR\Uninstall ArmBlocks Studio.exe"
  CreateShortcut "$DESKTOP\ArmBlocks Studio.lnk" "$INSTDIR\${PRODUCT_EXE}"

  WriteRegStr HKCU "Software\ArmBlocksStudio" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall ArmBlocks Studio.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\ArmBlocks Studio.lnk"
  RMDir /r "$SMPROGRAMS\ArmBlocks Studio"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "Software\ArmBlocksStudio"
  RMDir /r "$INSTDIR"
SectionEnd
