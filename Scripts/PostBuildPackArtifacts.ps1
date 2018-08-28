# for debug, in case it is not ran from appveyor CI system:
if (!$env:APPVEYOR_BUILD_FOLDER) {
	$scriptPath = split-path -parent $MyInvocation.MyCommand.Definition
	$env:APPVEYOR_BUILD_FOLDER = (get-item $scriptPath).parent.FullName
	if (!Test-Path "C:\Program Files\7-zip") {
		Write-Host "You need to install 7-zip in program files in order for this script to create the needed artifacts."
		exit
	}
	$env:Path += ";C:\Program Files\7-zip"
}

if (!$env:APPVEYOR_BUILD_VERSION) {
	$env:APPVEYOR_BUILD_VERSION = "1.0.0.0"
}

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"

$binFolder = get-ChildItem netcore* -recurse | Select-Object -first 1 | select -expand FullName

$artifactsFileName = "IsraelHiking_$env:APPVEYOR_BUILD_VERSION.zip"

7z a $artifactsFileName $binFolder\IsraelHiking*.*
7z a $artifactsFileName wwwroot
Push-AppveyorArtifact $artifactsFileName

# Building android:

$buildAndroidClient = "npm run build -- -c android --no-progress"
Write-Host $buildAndroidClient
Invoke-Expression $buildAndroidClient

$AddAndroid = "npm run add-android"
Write-Host $AddAndroid
Invoke-Expression $AddAndroid

$buildApk = "npm run build-apk"
Write-Host $buildApk
Invoke-Expression $buildApk

Push-AppveyorArtifact .\platforms\android\app\build\outputs\apk\release\app-release.apk

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER