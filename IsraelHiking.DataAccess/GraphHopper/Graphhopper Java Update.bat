REM @ECHO OFF
REM Copy GraphHopper JAR files to Site repository

SETLOCAL ENABLEDELAYEDEXPANSION

PUSHD %~dp0
SET JAR_DEST=%CD%
IF EXIST ..\..\..\GraphHopper\. (
  DEL /Q *.jar
  CD ..\..\..\GraphHopper
  FOR %%J in ( web\target\graphhopper-web-*-SNAPSHOT-with-dep.jar tools\target\graphhopper-tools-*-SNAPSHOT.jar ) DO (
    XCOPY %%J %JAR_DEST%
  )
)

REM Restore original Directory
POPD

@REM vim:sw=2:ai:ic:expandtab
