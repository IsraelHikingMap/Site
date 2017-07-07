
# for debug, in case it is not ran from appveyor CI system:
if (!$env:APPVEYOR_BUILD_FOLDER) {
	$scriptPath = split-path -parent $MyInvocation.MyCommand.Definition
	$env:APPVEYOR_BUILD_FOLDER = (get-item $scriptPath).parent.FullName
}

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER

# Restore all nuget packages

Write-Host "dotnet restore - to restore NuGet packages for build"

dotnet restore

# Restore all npm packages

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"
Write-Host "npm install - to restore npm packages for typescript build" 
npm install

# Compile TypeScript files using angular-cli

Write-Host "ng build - to build using angular-cli"
ng build --no-progress
	
if($LastExitCode -ne 0) 
{ 
	Write-Host "Compilation of $($project) failed"
	$host.SetShouldExit($LastExitCode)
}