Set-Location -Path $env:APPVEYOR_BUILD_FOLDER

$anyFailures = $FLASE

Write-Host "Run dotnet tests with coverage"

$DotnetTestsCmd = "dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=lcov /p:Exclude=`"[IsraelHiking.Common]*`" --logger trx"
Write-Host $DotnetTestsCmd
Invoke-Expression $DotnetTestsCmd

if ($LastExitCode) {
	$anyFailures = $TRUE
}



Write-Host "Run tests using Karma and export results as JUnit and Lcov format"

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)/IsraelHiking.Web"

Write-Host "npm ci"
npm ci

Write-Host "run lint - send warnings to appveyor"
npm run lint | Select-String -Pattern 'ERROR:' | ForEach-Object { Add-AppveyorCompilationMessage -Message $_.line -Category Warning; }

Write-Host "npm run test-ci"
npm run test-ci

# Locate Tests results files

$WebResultsFile = Get-ChildItem TESTS-*.xml -recurse | select-object -first 1 | select -expand FullName
Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)/Tests/IsraelHiking.API.Tests"
$APIResultsFile = Get-ChildItem *.trx -recurse | select-object -first 1 | select -expand FullName
Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)/Tests/IsraelHiking.DataAccess.Tests"
$DataAccessResultsFile = Get-ChildItem *.trx -recurse | select-object -first 1 | select -expand FullName

# Upload test results

$wc = New-Object 'System.Net.WebClient'
$wc.UploadFile("https://ci.appveyor.com/api/testresults/mstest/$($env:APPVEYOR_JOB_ID)", $APIResultsFile)
if ($LastExitCode) {
	$anyFailures = $TRUE
}
$wc.UploadFile("https://ci.appveyor.com/api/testresults/mstest/$($env:APPVEYOR_JOB_ID)", $DataAccessResultsFile)
if ($LastExitCode) {
	$anyFailures = $TRUE
}
$wc.UploadFile("https://ci.appveyor.com/api/testresults/junit/$($env:APPVEYOR_JOB_ID)", $WebResultsFile)
if ($LastExitCode) {
	$anyFailures = $TRUE
}

# Install codecov using .Net core
Write-Host "Installing codecov tool..."
dotnet tool install --global Codecov.Tool

# Locate coverage files

$APICoverage = "$($env:APPVEYOR_BUILD_FOLDER)/Tests/IsraelHiking.API.Tests/coverage.info"
$WebCoverage = "$($env:APPVEYOR_BUILD_FOLDER)/IsraelHiking.Web/coverage/lcov.info"

# Run codecov

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER
$CodeCovToken = "fc1bea1d-f43a-437e-84d3-baef07be7454"

$CodeCovCmd = "codecov -f $APICoverage -t $CodeCovToken"
Write-Host $CodeCovCmd
Invoke-Expression $CodeCovCmd
$CodeCovCmd = "codecov -f $WebCoverage -t $CodeCovToken"
Write-Host $CodeCovCmd
Invoke-Expression $CodeCovCmd

if ($LastExitCode) {
	$anyFailures = $TRUE
}

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)/IsraelHiking.Web"

Write-Host "npm run build:prod -- --no-progress"
npm run build:prod -- --no-progress

if ($lastexitcode)
{
	Write-Host "Failing build due to web client build failing"
	throw $lastexitcode
}

if ($anyFailures -eq $TRUE){
    Write-Host "Failing build as there are broken tests"
    throw $lastexitcode
}

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER
