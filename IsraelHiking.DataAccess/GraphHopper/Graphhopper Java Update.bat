REM @ECHO OFF
REM
REM This script updates the JAR files in the
REM ```IsraelHikingMap\Site```repository from the latest JAR files built in the
REM ```IsraelHikingMap\graphhopper``` repository.
REM
REM It uses ```~dp0``` to determine the location of the target directory
REM

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
