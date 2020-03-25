choco install gradle --version 4.9 --no-progress

$env:Path += ";C:\ProgramData\chocolatey\lib\gradle\tools\gradle-4.9\bin;$env:ANDROID_HOME\tools\bin\;C:\Program Files\Git\mingw64\libexec\git-core"

gradle --version

for($i=0;$i -lt 30;$i++) { $response += "y`n"};

Invoke-Expression """$response"" | sdkmanager.bat --licenses"

Invoke-Expression """$response"" | sdkmanager.bat --update | out-null"

Invoke-Expression "sdkmanager.bat ""platform-tools"" ""tools"" ""platforms;android-26"" ""build-tools;28.0.2"" ""extras;google;m2repository"" | out-null"

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

$preVersionAabLocation = ".\platforms\android\app\build\outputs\bundle\release\app.aab";
$aabVersioned = ".\platforms\android\app\build\outputs\bundle\release\IHM_signed_$env:APPVEYOR_BUILD_VERSION.aab"

Rename-Item -Path $preVersionAabLocation -NewName "IHM_signed_$env:APPVEYOR_BUILD_VERSION.aab"

if (-not (Test-Path -Path $aabVersioned)) {
	throw "Failed to create Android aab file"
}

Push-AppveyorArtifact $aabVersioned

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER