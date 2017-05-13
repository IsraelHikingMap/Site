@REM Update the Site DB's as an administrator
@REM Usage UpdateDB <updated osm.pbf file>

COPY "%~1" "%~dp0\israel-and-palestine-latest.osm.pbf"
runas /savecred /user:administrator "cmd /c cd \"%~dp0 \" & dotnet.exe IsraelHiking.Updater.dll -g -e > IsraelHiking.Updater.log 2>&1 "
