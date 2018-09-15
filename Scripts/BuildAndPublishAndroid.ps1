if (!$env:APPVEYOR_BUILD_VERSION) {
	$env:APPVEYOR_BUILD_VERSION = "1.0.0.0"
}

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"

# Building android:

$buildAndroidClient = "npm run build -- -c android --no-progress"
Write-Host $buildAndroidClient
Invoke-Expression $buildAndroidClient

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

$apkArmv7Versioned = ".\IHM_signed_armv7_$env:APPVEYOR_BUILD_VERSION.apk"
$apkx86Versioned = ".\IHM_signed_x86_$env:APPVEYOR_BUILD_VERSION.apk"

Write-Host "Signing apks"
Invoke-Expression "$env:ANDROID_HOME\build-tools\28.0.2\bin\apksigner.bat sign --ks .\IHM.jks --out $apkArmv7Versioned .\platforms\android\app\build\outputs\apk\armv7\release\app-armv7-release-unsigned.apk --ks-pass $env:STORE_PASSWORD --key-pass $env:PASSWORD"
Invoke-Expression "$env:ANDROID_HOME\build-tools\28.0.2\bin\apksigner.bat sign --ks .\IHM.jks --out $apkx86Versioned .\platforms\android\app\build\outputs\apk\x86\release\app-x86-release-unsigned.apk --ks-pass $env:STORE_PASSWORD --key-pass $env:PASSWORD"

Push-AppveyorArtifact $apkArmv7Versioned
Push-AppveyorArtifact $apkx86Versioned

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER