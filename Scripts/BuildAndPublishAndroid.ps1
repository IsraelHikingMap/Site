iex ((new-object net.webclient).DownloadString('https://raw.githubusercontent.com/appveyor/ci/master/scripts/enable-rdp.ps1'))
$blockRdp = $true;
choco install gradle --version 4.10.3 --no-progress

refreshenv

$env:PATH += ";$env:ANDROID_HOME\tools\bin\"

gradle --version

for($i=0;$i -lt 30;$i++) { $response += "y`n"};

Invoke-Expression """$response"" | sdkmanager.bat --licenses"

Invoke-Expression """$response"" | sdkmanager.bat --update | out-null"

Invoke-Expression "sdkmanager.bat ""platform-tools"" ""tools"" ""platforms;android-26"" ""build-tools;28.0.2"" ""extras;google;m2repository"" | out-null"

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"

# Building android:
Write-Host "npm install --loglevel=error"
npm install --loglevel=error

Write-Host "npm run build:cordova -- --no-progress"
npm run build:cordova -- --no-progress

if ($lastexitcode)
{
	throw $lastexitcode
}

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
Invoke-Expression "& ""$env:ANDROID_HOME\build-tools\28.0.2\apksigner.bat"" sign --ks .\signing\IHM.jks --ks-pass pass:$env:STORE_PASSWORD --key-pass pass:$env:PASSWORD --out $apkVersioned $preSignApkLocation"

Push-AppveyorArtifact $apkVersioned

#if ($env:APPVEYOR_REPO_TAG -eq "true")
#{
	Write-Host "npm install -g google-playstore-publisher"
	npm install -g google-playstore-publisher
	Write-Host "Wrtiting json file"
	$env:PLAYSTORE_JSON | Out-File -FilePath ./playstore_service_account.json
	Write-Host((Get-Item playstore_service_account.json).length/1KB)
	Write-Host "Invoking playstore publisher"
	playstore -t=internal -p=il.org.osm.israelhiking -k=./playstore_service_account.json -a=$apkVersioned
#}

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER