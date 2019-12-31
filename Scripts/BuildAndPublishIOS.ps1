Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"


#Replace version in config.xml file
$filePath = get-ChildItem config.xml | Select-Object -first 1 | select -expand FullName
$xml = New-Object XML
$xml.Load($filePath)
$xml.widget.version = $env:APPVEYOR_BUILD_VERSION
$xml.Save($filePath)

Write-Host "Decripting files"
Invoke-Expression "& openssl aes-256-cbc -k $env:PASSWORD -in ./signing/appveyor.mobileprovision.enc -d -a -out ./signing/appveyor.mobileprovision"
Invoke-Expression "& openssl aes-256-cbc -k $env:PASSWORD -in ./signing/ihm-dist.cer.enc -d -a -out ./signing/ihm-dist.cer"
Invoke-Expression "& openssl aes-256-cbc -k $env:PASSWORD -in ./signing/ihm-dist.p12.enc -d -a -out ./signing/ihm-dist.p12"

Write-Host "Create a custom keychain"
security create-keychain -p appveyor ios-build.keychain

Write-Host "Make the custom keychain default, so xcodebuild will use it for signing"
security default-keychain -s ios-build.keychain

Write-Host "Unlock the keychain"
security unlock-keychain -p appveyor ios-build.keychain

# Set keychain timeout to 1 hour for long builds
# see http://www.egeek.me/2013/02/23/jenkins-and-xcode-user-interaction-is-not-allowed/
security set-keychain-settings -t 3600 -l ~/Library/Keychains/ios-build.keychain

# Avoid popup for keychain password
# https://medium.com/@ceyhunkeklik/how-to-fix-ios-application-code-signing-error-4818bd331327
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k appveyor ~/Library/Keychains/ios-build.keychain

Write-Host "Add certificates to keychain and allow codesign to access them"
security import ./signing/apple.cer -k ~/Library/Keychains/ios-build.keychain -T /usr/bin/codesign
security import ./signing/ihm-dist.cer -k ~/Library/Keychains/ios-build.keychain -T /usr/bin/codesign
security import ./signing/ihm-dist.p12 -k ~/Library/Keychains/ios-build.keychain -P $env:STORE_PASSWORD -T /usr/bin/codesign

New-Item -ItemType "directory" -Path "~/Library/MobileDevice/Provisioning Profiles" -Verbose
Copy-Item "./signing/appveyor.mobileprovision" -Destination "~/Library/MobileDevice/Provisioning Profiles/" -Verbose

# Building ios:
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

Write-Host "npm run add-ios"
npm run add-ios

Write-Host "npm run build-ipa"
npm run build-ipa

$preVersionIpaLocation = ".\platforms\ios\build\device\Israel Hiking Map.ipa";
$ipaVersioned = ".\platforms\ios\build\device\IHM_signed_$env:APPVEYOR_BUILD_VERSION.ipa"

if (-not (Test-Path -Path $preVersionIpaLocation)) {
	throw "Failed to create ios ipa file"
}

Rename-Item -Path $preVersionIpaLocation -NewName $ipaVersioned

Push-AppveyorArtifact $ipaVersioned

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER