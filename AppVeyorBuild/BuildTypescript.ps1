
# for debug, in case it is not ran from appveyor CI system:
if (!$env:APPVEYOR_BUILD_FOLDER) {
	$scriptPath = split-path -parent $MyInvocation.MyCommand.Definition
	$env:APPVEYOR_BUILD_FOLDER = (get-item $scriptPath).parent.FullName
}

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER

# Restore all packages

dotnet restore

# Locate executables

$npm = get-childitem "C:\Program Files (x86)\Microsoft Visual Studio\2017" npm.cmd -recurse | select-object -first 1 | select -expand FullName

$tsc = get-childitem "C:\Users\$($env:UserName)\.nuget\packages\" tsc.exe -recurse | select-object -first 1 | select -expand FullName

$webProjects = @("IsraelHiking.Web", "Tests\IsraelHiking.Web.Tests")

# Compile TypeScript files

foreach ($project in $webProjects) 
{
	$path = Join-Path $env:APPVEYOR_BUILD_FOLDER $project

	Set-Location -Path $path
    Write-Host "$($npm) install - to restore npm packages for typescript build" 
	& $npm install

	Set-Location -Path $env:APPVEYOR_BUILD_FOLDER

	Write-Host $tsc "-p $($project)"
	& $tsc -p $project
	
	if($LastExitCode -ne 0) 
	{ 
		$host.SetShouldExit($LastExitCode)
		Write-Host "Compilation of $($project) failed"
	}
}