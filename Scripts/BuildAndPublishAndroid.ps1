if (!$env:APPVEYOR_BUILD_VERSION) {
	$env:APPVEYOR_BUILD_VERSION = "1.0.0.0"
}

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"

# Building android:
Write-Host "npm install --loglevel=error"
npm install --loglevel=error

Write-Host "increase-memory-limit"
increase-memory-limit

Write-Host "npm run build:cordova -- --no-progress"
npm run build:cordova -- --no-progress

if ($lastexitcode)
{
	throw $lastexitcode
}

Write-Host "npm ls npm"
npm ls npm

Write-Host "npm run add-android"
npm run add-android

#Replace version in config.xml file

$filePath = get-ChildItem config.xml | Select-Object -first 1 | select -expand FullName
$xml = New-Object XML
$xml.Load($filePath)
$xml.widget.version = $env:APPVEYOR_BUILD_VERSION
$xml.Save($filePath)


Write-Host "npm run build-apk"
npm run build-apk

$apkVersioned = ".\IHM_signed_$env:APPVEYOR_BUILD_VERSION.apk"
$preSignApkLocation = ".\platforms\android\app\build\outputs\apk\release\app-release-unsigned.apk";

if (-not (Test-Path -Path $preSignApkLocation)) {
	throw "Failed to create android apk file"
}

Write-Host "Signing apk"
Invoke-Expression "& ""$env:ANDROID_HOME\build-tools\28.0.2\apksigner.bat"" sign --ks .\IHM.jks --ks-pass pass:$env:STORE_PASSWORD --key-pass pass:$env:PASSWORD --out $apkVersioned $preSignApkLocation"

Push-AppveyorArtifact $apkVersioned

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER