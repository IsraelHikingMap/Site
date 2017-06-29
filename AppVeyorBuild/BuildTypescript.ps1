
# for debug, in case it is not ran from appveyor CI system:
if (!$env:APPVEYOR_BUILD_FOLDER) {
	$scriptPath = split-path -parent $MyInvocation.MyCommand.Definition
	$env:APPVEYOR_BUILD_FOLDER = (get-item $scriptPath).parent.FullName
}

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER

# Restore all packages

Write-Host "dotnet restore - to restore NuGet packages for build"

dotnet restore

# Locate executables

$webProjects = @("IsraelHiking.Web") #, "Tests\IsraelHiking.Web.Tests")

# Compile TypeScript files

foreach ($project in $webProjects) 
{
	$path = Join-Path $env:APPVEYOR_BUILD_FOLDER $project

	Set-Location -Path $path
    Write-Host "npm install - to restore npm packages for typescript build" 
	npm install

	Write-Host "ng build - to build using angular-cli"
	ng build --no-progress
	
	if($LastExitCode -ne 0) 
	{ 
		$host.SetShouldExit($LastExitCode)
		Write-Host "Compilation of $($project) failed"
	}
}