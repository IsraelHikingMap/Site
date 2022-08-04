choco install gradle --version 7.4.2 --no-progress

refreshenv

$env:PATH += ";$env:ANDROID_HOME/tools/bin/"

for($i=0;$i -lt 30;$i++) { $response += "y`n"};

Invoke-Expression """$response"" | sdkmanager.bat --licenses | out-null"

Invoke-Expression """$response"" | sdkmanager.bat --update | out-null"

Invoke-Expression "sdkmanager.bat ""platform-tools"" ""tools"" ""platforms;android-30"" ""build-tools;30.0.3"" ""extras;google;m2repository"" | out-null"

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)/IsraelHiking.Web"

Write-Host "npm ci"
npm ci

Write-Host "npm run build:mobile -- --no-progress"
npm run build:mobile -- --no-progress

if ($lastexitcode)
{
	throw $lastexitcode
}

Write-Host "npx cap sync"
npx cap sync

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)/IsraelHiking.Web/android"

$versionCode = [System.Version]::Parse($env:APPVEYOR_BUILD_VERSION)
$versionCodeString = $versionCode.Major * 10000 + $versionCode.Minor * 100 + $versionCode.Build

Write-Host "Replace version in gradle file to $env:APPVEYOR_BUILD_VERSION $versionCodeString"
$filePath = get-ChildItem build.gradle -Path app | Select-Object -first 1 | select -expand FullName
(Get-Content -path $filePath -Raw) `
	-replace 'versionCode (\d+)',"versionCode $versionCodeString" `
	-replace 'versionName "([0-9.]+)"',"versionName ""$env:APPVEYOR_BUILD_VERSION""" `
	| Set-Content -Path $filePath

$aabVersioned = "./IHM_signed_$env:APPVEYOR_BUILD_VERSION.aab"
if ($env:STORE_PASSWORD -ne $null) {
	./gradlew :app:bundleRelease "-Pandroid.injected.signing.store.file=$env:APPVEYOR_BUILD_FOLDER/IsraelHiking.Web/signing/IHM.jks" "-Pandroid.injected.signing.store.password=$env:STORE_PASSWORD" "-Pandroid.injected.signing.key.alias=ihmkey" "-Pandroid.injected.signing.key.password=$env:PASSWORD"
} else {
	./gradlew bundleRelease
	$aabVersioned = "./IHM_unsigned_$env:APPVEYOR_BUILD_VERSION.aab"
}
$preVersionAabLocation = "./app/build/outputs/bundle/release/app-release.aab";

if (-not (Test-Path -Path $preVersionAabLocation)) {
	throw "Failed to create android aab file"
}

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