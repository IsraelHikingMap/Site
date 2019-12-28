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

#Replace version in config.xml file
$filePath = get-ChildItem config.xml | Select-Object -first 1 | select -expand FullName
$xml = New-Object XML
$xml.Load($filePath)
$xml.widget.version = $env:APPVEYOR_BUILD_VERSION
$xml.Save($filePath)

Write-Host "npm run add-ios"
npm run add-ios

Write-Host "npm run build-ipa"
npm run build-ipa

$ipaVersioned = ".\IHM_signed_$env:APPVEYOR_BUILD_VERSION.ipa"
#$preSignIpaLocation = ".\platforms\ios\app\build\outputs\ipa\release\app-release-unsigned.apk";

#if (-not (Test-Path -Path $preSignIpaLocation)) {
#	throw "Failed to create android apk file"
#}

#Push-AppveyorArtifact $apkVersioned

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER