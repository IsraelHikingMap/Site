Set-Location -Path $env:APPVEYOR_BUILD_FOLDER

$anyFailures = $FLASE

# Run dotnet tests with coverage

$DotnetTestsCmd = "dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=lcov /p:Exclude=`"[IsraelHiking.Common]*`" --logger trx"
Write-Host $DotnetTestsCmd
Invoke-Expression $DotnetTestsCmd

if ($LastExitCode) {
	$anyFailures = $TRUE
}

# Run tests using Karma and export results as JUnit and Lcov format

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"

Write-Host "npm install --loglevel=error"
npm install --loglevel=error

Write-Host "increase-memory-limit"
increase-memory-limit

Write-Host "run lint - send warnings to appveyor"
npm run lint | Select-String -Pattern 'ERROR:' | ForEach-Object { Add-AppveyorCompilationMessage -Message $_.line -Category Warning; }

Write-Host "npm run test -- --code-coverage --watch=false"
npm run test -- --code-coverage --watch=false

# Locate Tests results files

$WebResultsFile = Get-ChildItem tests-chrome*.xml -recurse | select-object -first 1 | select -expand FullName
Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\Tests\IsraelHiking.API.Tests"
$APIResultsFile = Get-ChildItem *.trx -recurse | select-object -first 1 | select -expand FullName
Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\Tests\IsraelHiking.DataAccess.Tests"
$DataAccessResultsFile = Get-ChildItem *.trx -recurse | select-object -first 1 | select -expand FullName

# Upload test resutls

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

# Locate codecov

$CodeCov = get-childitem "C:\Users\$($env:UserName)\.nuget\packages\" codecov.exe -recurse | select-object -first 1 | select -expand FullName

# Locate coverage files

$APICoverage = "$($env:APPVEYOR_BUILD_FOLDER)\Tests\IsraelHiking.API.Tests\coverage.info"
$WebCoverage = "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web\coverage\lcov.info"

# Run codecov

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER
$CodeCovToken = "fc1bea1d-f43a-437e-84d3-baef07be7454"

$CodeCovCmd = "$($CodeCov) -f $APICoverage -t $CodeCovToken"
Write-Host $CodeCovCmd
Invoke-Expression $CodeCovCmd
$CodeCovCmd = "$($CodeCov) -f $WebCoverage -t $CodeCovToken"
Write-Host $CodeCovCmd
Invoke-Expression $CodeCovCmd

if ($LastExitCode) {
	$anyFailures = $TRUE
}

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"

Write-Host "npm run build -- --prod --no-progress"
npm run build -- --prod --no-progress

if ($lastexitcode)
{
	Write-Host "Failing build due to web client build failing"
	throw $lastexitcode
}

Set-Location -Path "$($env:APPVEYOR_BUILD_FOLDER)\IsraelHiking.Web"

Write-Host "dotnet publish"
dotnet publish

$binFolder = get-ChildItem netcore* -recurse | Select-Object -first 1 | select -expand FullName

$artifactsFileName = "IsraelHiking_$env:APPVEYOR_BUILD_VERSION.zip"

7z a $artifactsFileName $binFolder\publish\IsraelHiking*.*
7z a $artifactsFileName wwwroot
Push-AppveyorArtifact $artifactsFileName

if ($anyFailures -eq $TRUE){
    Write-Host "Failing build as there are broken tests"
    $host.SetShouldExit(1)
}

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER
