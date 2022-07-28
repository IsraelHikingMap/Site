sudo gem install cocoapods
$env:LANG=en_US.UTF-8
$env:LANGUAGE=en_US.UTF-8
$env:LC_ALL=en_US.UTF-8

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)/IsraelHiking.Web"

if ($env:PASSWORD -eq $null) {
	Write-Host "Can't build iOS without a password for the encripted files"
	Exit
}

Write-Host "Decrypting files"
Invoke-Expression "& openssl aes-256-cbc -k $env:PASSWORD -in ./signing/appveyor.mobileprovision.enc -d -a -out ./signing/appveyor.mobileprovision"
Invoke-Expression "& openssl aes-256-cbc -k $env:PASSWORD -in ./signing/ihm-dist.cer.enc -d -a -out ./signing/ihm-dist.cer"
Invoke-Expression "& openssl aes-256-cbc -k $env:PASSWORD -in ./signing/ihm-dist.p12.enc -d -a -out ./signing/ihm-dist.p12"

Write-Host "Create a custom keychain"
security create-keychain -p appveyor ios-build.keychain

Write-Host "Make the custom keychain default, so xcodebuild will use it for signing"
security default-keychain -s ios-build.keychain

Write-Host "Unlock the keychain"
security unlock-keychain -p appveyor ios-build.keychain

Write-Host "Set keychain timeout to 1 hour to allow signing later in the build process"
# see http://www.egeek.me/2013/02/23/jenkins-and-xcode-user-interaction-is-not-allowed/
security set-keychain-settings -t 3600 -l ~/Library/Keychains/ios-build.keychain

Write-Host "Add certificates to keychain and allow codesign to access them"
security import ./signing/apple.cer -k ~/Library/Keychains/ios-build.keychain -T /usr/bin/codesign
security import ./signing/ihm-dist.cer -k ~/Library/Keychains/ios-build.keychain -T /usr/bin/codesign
security import ./signing/ihm-dist.p12 -k ~/Library/Keychains/ios-build.keychain -P $env:STORE_PASSWORD -T /usr/bin/codesign

Write-Host "Avoid popup for keychain password by setting partition list"
# https://medium.com/@ceyhunkeklik/how-to-fix-ios-application-code-signing-error-4818bd331327
# Must be after the import process
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k appveyor ~/Library/Keychains/ios-build.keychain

Write-Host "Copy provisioning file"
New-Item -ItemType "directory" -Path "~/Library/MobileDevice/Provisioning Profiles"
Copy-Item "./signing/appveyor.mobileprovision" -Destination "~/Library/MobileDevice/Provisioning Profiles/"

# Building ios:
Write-Host "npm ci"
npm ci

Write-Host "npm run build:cordova -- --no-progress"
npm run build:cordova -- --no-progress

if ($lastexitcode)
{
	throw $lastexitcode
}

Write-Host "npx cap sync"
npx cap sync

$versionCode = [System.Version]::Parse($env:APPVEYOR_BUILD_VERSION)
$versionCodeString = $versionCode.Major * 10000 + $versionCode.Minor * 100 + $versionCode.Build
Write-Host "npx capacitor-set-version $env:APPVEYOR_BUILD_VERSION $versionCodeString"
npx capacitor-set-version -v $env:APPVEYOR_BUILD_VERSION -b $versionCodeString

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)/IsraelHiking.Web/ios"

Write-Host "Archiving..."
xcodebuild -workspace App/App.xcworkspace -scheme App -archivePath App.xcarchive -configuration Release -destination generic/platform=iOS archive

Write-Host "Exporting..."
xcodebuild -exportArchive -archivePath App.xcarchive -exportPath ./ -exportOptionsPlist exportOptions.plist


$preVersionIpaLocation = "./App.ipa";
$ipaVersioned = "./IHM_signed_$env:APPVEYOR_BUILD_VERSION.ipa"

Copy-Item -Path $preVersionIpaLocation -Destination $ipaVersioned

if (-not (Test-Path -Path $ipaVersioned)) {
	throw "Failed to create ios ipa file"
}

Push-AppveyorArtifact $ipaVersioned

if ($env:APPVEYOR_REPO_TAG -eq "true")
{
	Write-Host "Uploading package to the apple app store"
	xcrun altool --upload-app --type ios --file $ipaVersioned --username $env:TMS_USER --password $env:TMS_APPLE_APPLICATION_SPECIFIC_PASSWORD
}


Set-Location -Path $env:APPVEYOR_BUILD_FOLDER
