# for debug, in case it is not ran from appveyor CI system:
if (!$env:APPVEYOR_BUILD_FOLDER) {
	$scriptPath = split-path -parent $MyInvocation.MyCommand.Definition
	$env:APPVEYOR_BUILD_FOLDER = (get-item $scriptPath).parent.FullName
}

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER

# Locate Files

$OpenCover = get-ChildItem "C:\Users\$($env:UserName)\.nuget\packages\" OpenCover.Console.exe -recurse | select-object -first 1 | select -expand FullName
$dotnet = get-childitem "C:\Program Files\dotnet\" dotnet.exe -recurse | Select-Object -first 1 | select -expand FullName
$DATests = get-ChildItem IsraelHiking.DataAccess.Tests.csproj -recurse | Select-Object -first 1 | select -expand FullName
$APITests = get-ChildItem IsraelHiking.API.Tests.csproj -recurse | Select-Object -first 1 | select -expand FullName

$OpenCoverDACoverageFile = "$($env:APPVEYOR_BUILD_FOLDER)\coverage-opencover-dataaccess.xml"
$OpenCoverAPICoverageFile = "$($env:APPVEYOR_BUILD_FOLDER)\coverage-opencover-api.xml"
$OpenCoverDAResultsFile = "$($env:APPVEYOR_BUILD_FOLDER)\results-dataaccess.trx"
$OpenCoverAPIResultsFile = "$($env:APPVEYOR_BUILD_FOLDER)\results-api.trx"

# Run OpenCover

$OpenCoverCmd = "$($OpenCover) -oldstyle -register:user -target:`"$($dotnet)`" -targetargs:`"test --logger:trx;LogFileName=$OpenCoverDAResultsFile /p:DebugType=full $DATests`" -filter:`"+[*]*API* +[*]*Database* +[*]*GPSBabel* -[*]*JsonResponse* -[*]*GpxTypes* -[*]*Tests*`" -excludebyattribute:`"*.ExcludeFromCodeCoverage*`" -output:$OpenCoverDACoverageFile"
Write-Host $OpenCoverCmd
Invoke-Expression $OpenCoverCmd

$OpenCoverCmd = "$($OpenCover) -oldstyle -register:user -target:`"$($dotnet)`" -targetargs:`"test --logger:trx;LogFileName=$OpenCoverAPIResultsFile /p:DebugType=full $APITests`" -filter:`"+[*]*API* +[*]*Database* +[*]*GPSBabel* -[*]*JsonResponse* -[*]*GpxTypes* -[*]*Tests*`" -excludebyattribute:`"*.ExcludeFromCodeCoverage*`" -output:$OpenCoverAPICoverageFile"
Write-Host $OpenCoverCmd
Invoke-Expression $OpenCoverCmd

# Run tests using Karma and export results as JUnit and Lcov format

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"

Write-Host "npm install --loglevel=error"
npm install --loglevel=error

Write-Host "increase-memory-limit"
increase-memory-limit

Write-Host "npm run build -- --prod --no-progress"
npm run build -- --prod --no-progress

if ($lastexitcode)
{
	throw $lastexitcode
}

Write-Host "run lint - send warnings to appveyor"
npm run lint | Select-String -Pattern 'ERROR:' | ForEach-Object { Add-AppveyorCompilationMessage -Message $_.line -Category Warning; }

Write-Host "npm run test -- --no-progress --code-coverage --watch=false"
npm run test -- --no-progress --code-coverage --watch=false

# Locate JUnit XML results file

$JUnitFile = Get-ChildItem tests-chrome*.xml -recurse | select-object -first 1 | select -expand FullName

# Upload test resutls
$anyFailures = $FLASE

$wc = New-Object 'System.Net.WebClient'
$wc.UploadFile("https://ci.appveyor.com/api/testresults/mstest/$($env:APPVEYOR_JOB_ID)", $OpenCoverAPIResultsFile)
if ($LastExitCode) {
	$anyFailures = $TRUE
}
$wc.UploadFile("https://ci.appveyor.com/api/testresults/mstest/$($env:APPVEYOR_JOB_ID)", $OpenCoverDAResultsFile)
if ($LastExitCode) {
	$anyFailures = $TRUE
}
$wc.UploadFile("https://ci.appveyor.com/api/testresults/junit/$($env:APPVEYOR_JOB_ID)", $JUnitFile)
if ($LastExitCode) {
	$anyFailures = $TRUE
}
# Locate Lcov coverage file

$LcovCoverageFile = "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web\coverage\lcov.info"

# Locate codecov

$CodeCov = get-childitem "C:\Users\$($env:UserName)\.nuget\packages\" codecov.exe -recurse | select-object -first 1 | select -expand FullName

# Run codecov

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER
$CodeCovToken = "fc1bea1d-f43a-437e-84d3-baef07be7454"

$CodeCovCmd = "$($CodeCov) -f $OpenCoverAPICoverageFile -t $CodeCovToken"
Write-Host $CodeCovCmd
Invoke-Expression $CodeCovCmd
$CodeCovCmd = "$($CodeCov) -f $OpenCoverDACoverageFile -t $CodeCovToken"
Write-Host $CodeCovCmd
Invoke-Expression $CodeCovCmd
$CodeCovCmd = "$($CodeCov) -f $LcovCoverageFile -t $CodeCovToken"
Write-Host $CodeCovCmd
Invoke-Expression $CodeCovCmd

if ($LastExitCode) {
	$anyFailures = $TRUE
}


if ($anyFailures -eq $TRUE){
    write-host "Failing build as there are broken tests"
    $host.SetShouldExit(1)
}


