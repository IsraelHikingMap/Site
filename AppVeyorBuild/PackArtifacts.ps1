# for debug, in case it is not ran from appveyor CI system:
if (!$env:APPVEYOR_BUILD_FOLDER) {
	$scriptPath = split-path -parent $MyInvocation.MyCommand.Definition
	$env:APPVEYOR_BUILD_FOLDER = (get-item $scriptPath).parent.FullName
}

if (!$env:APPVEYOR_BUILD_VERSION) {
	$env:APPVEYOR_BUILD_VERSION = "1.0.0.0"
}

$binFolder = get-ChildItem IsraelHiking.Web netcore* -recurse | Select-Object -first 1 | select -expand FullName

7z a IsraelHiking$env:APPVEYOR_BUILD_VERSION.zip $binFolder\IsraelHiking*.dll
7z a IsraelHiking$env:APPVEYOR_BUILD_VERSION.zip IsraelHiking.Web\wwwroot
Push-AppveyorArtifact IsraelHiking$env:APPVEYOR_BUILD_VERSION.zip