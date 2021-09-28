#choco install gradle --version 7.1.1 --no-progress

refreshenv

$env:PATH += ";$env:ANDROID_HOME/tools/bin/"

#gradle --version

for($i=0;$i -lt 30;$i++) { $response += "y`n"};

Invoke-Expression """$response"" | sdkmanager.bat --licenses"

Invoke-Expression """$response"" | sdkmanager.bat --update | out-null"

Invoke-Expression "sdkmanager.bat ""platform-tools"" ""tools"" ""platforms;android-30"" ""build-tools;31.0.0"" ""extras;google;m2repository"" | out-null"

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)/IsraelHiking.Web"

# Building android:
Write-Host "npm install"
npm install

Write-Host "npm run build:cordova -- --no-progress"
npm run build:cordova -- --no-progress

if ($lastexitcode)
{
	throw $lastexitcode
}

Write-Host "npm run add-android"
npm run add-android

Write-Host "Replacing version in config.xml file"
$filePath = get-ChildItem config.xml | Select-Object -first 1 | select -expand FullName
$xml = New-Object XML
$xml.Load($filePath)
$xml.widget.version = $env:APPVEYOR_BUILD_VERSION
$xml.Save($filePath)

Write-Host "cordova build android --release --  --packageType=apk"
npx cordova build android --release -- --keystore=./signing/IHM.jks --storePassword=$env:STORE_PASSWORD --alias=ihmkey --password=$env:PASSWORD --packageType=apk
$preVersionApkLocation = "./platforms/android/app/build/outputs/apk/release/app-release.apk";

if (-not (Test-Path -Path $preVersionApkLocation)) {
	throw "Failed to create android apk file"
}

$apkVersioned = "./IHM_signed_$env:APPVEYOR_BUILD_VERSION.apk"
Copy-Item -Path $preVersionApkLocation -Destination $apkVersioned
Push-AppveyorArtifact $apkVersioned

Write-Host "cordova build android --release --  --packageType=bundle"
npx cordova build android --release -- --keystore=./signing/IHM.jks --storePassword=$env:STORE_PASSWORD --alias=ihmkey --password=$env:PASSWORD --packageType=bundle
$aabVersioned = "./IHM_signed_$env:APPVEYOR_BUILD_VERSION.aab"
$preVersionAabLocation = "./platforms/android/app/build/outputs/bundle/release/app-release.aab";
Copy-Item -Path $preVersionAabLocation -Destination $aabVersioned
Push-AppveyorArtifact $aabVersioned


if ($env:APPVEYOR_REPO_TAG -eq "true")
{
	Write-Host "Wrtiting json file"
	$env:PLAYSTORE_JSON | Out-File -FilePath ./playstore_service_account.json
	Write-Host "Uploading file to play store"
	npx apkup upload -k ./playstore_service_account.json -a $aabVersioned -t 'internal'
}

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER