Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"


#Replace version in config.xml file
$filePath = get-ChildItem config.xml | Select-Object -first 1 | select -expand FullName
$xml = New-Object XML
$xml.Load($filePath)
$xml.widget.version = $env:APPVEYOR_BUILD_VERSION
$xml.Save($filePath)

Write-Host "Decripting files"
Invoke-Expression "& openssl aes-256-cbc -k $env:PASSWORD -in ./certificates/appveyor.mobileprovision.enc -d -a -out ./certificates/appveyor.mobileprovision.enc"
Invoke-Expression "& openssl aes-256-cbc -k $env:PASSWORD -in ./certificates/ihm-dist.cer.enc -d -a -out ./certificates/dist.cer"
Invoke-Expression "& openssl aes-256-cbc -k $env:PASSWORD -in ./certificates/ihm-dist.p12.enc -d -a -out ./certificates/dist.p12"

Write-Host "Create a custom keychain"
security create-keychain -p appveyor ios-build.keychain

Write-Host "Make the custom keychain default, so xcodebuild will use it for signing"
security default-keychain -s ios-build.keychain

Write-Host "Unlock the keychain"
security unlock-keychain -p appveyor ios-build.keychain

# Set keychain timeout to 1 hour for long builds
# see http://www.egeek.me/2013/02/23/jenkins-and-xcode-user-interaction-is-not-allowed/
security set-keychain-settings -t 3600 -l ~/Library/Keychains/ios-build.keychain

Write-Host "Add certificates to keychain and allow codesign to access them"
security import ./certificates/apple.cer -k ~/Library/Keychains/ios-build.keychain -T /usr/bin/codesign
security import ./certificates/ihm-dist.cer -k ~/Library/Keychains/ios-build.keychain -T /usr/bin/codesign
security import ./certificates/ihm-dist.p12 -k ~/Library/Keychains/ios-build.keychain -P $KEY_PASSWORD -T /usr/bin/codesign

New-Item -ItemType "directory" -Path "~/Library/MobileDevice/Provisioning Profiles" -Verbose
Copy-Item "./certificates/appveyor.mobileprovision" -Destination "~/Library/MobileDevice/Provisioning Profiles/" -Verbose

# Building ios:
Write-Host "npm install --loglevel=error"
npm install --loglevel=error

Write-Host "increase-memory-limit"
increase-memory-limit

Write-Host "npm run add-ios"
npm run add-ios

Write-Host "npm run build:cordova -- --no-progress"
npm run build:cordova -- --no-progress

if ($lastexitcode)
{
	throw $lastexitcode
}

Write-Host "npm run build-ipa"
npm run build-ipa

$ipaVersioned = ".\IHM_signed_$env:APPVEYOR_BUILD_VERSION.ipa"
#$preSignIpaLocation = ".\platforms\ios\app\build\outputs\ipa\release\app-release-unsigned.apk";

#if (-not (Test-Path -Path $preSignIpaLocation)) {
#	throw "Failed to create ios apk file"
#}

#Push-AppveyorArtifact $apkVersioned

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER