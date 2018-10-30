if (!$env:APPVEYOR_BUILD_VERSION) {
	$env:APPVEYOR_BUILD_VERSION = "1.0.0.0"
}

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"

# Building android:

$buildAndroidClient = "npm run build -- -c android --no-progress"
Write-Host $buildAndroidClient
Invoke-Expression $buildAndroidClient

if ($lastexitcode)
{
	throw $lastexitcode
}

$AddAndroid = "npm run add-android"
Write-Host $AddAndroid
Invoke-Expression $AddAndroid

#Replace version in config.xml file

$filePath = get-ChildItem config.xml | Select-Object -first 1 | select -expand FullName
$xml = New-Object XML
$xml.Load($filePath)
$xml.widget.version = $env:APPVEYOR_BUILD_VERSION
$xml.Save($filePath)


Write-Host "npm run build-apk"
Invoke-Expression "npm run build-apk"

$apkVersioned = ".\IHM_signed_$env:APPVEYOR_BUILD_VERSION.apk"

Write-Host "Signing apk"
Invoke-Expression "& ""$env:ANDROID_HOME\build-tools\28.0.2\apksigner.bat"" sign --ks .\IHM.jks --ks-pass pass:$env:STORE_PASSWORD --key-pass pass:$env:PASSWORD --out $apkVersioned .\platforms\android\app\build\outputs\apk\release\app-release-unsigned.apk"

Push-AppveyorArtifact $apkVersioned

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER