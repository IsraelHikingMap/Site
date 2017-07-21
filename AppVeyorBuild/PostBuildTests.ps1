# for debug, in case it is not ran from appveyor CI system:
if (!$env:APPVEYOR_BUILD_FOLDER) {
	$scriptPath = split-path -parent $MyInvocation.MyCommand.Definition
	$env:APPVEYOR_BUILD_FOLDER = (get-item $scriptPath).parent.FullName
}

if (!$env:COVERALLS_REPO_TOKEN) {
	$env:COVERALLS_REPO_TOKEN = "w3WvP9CEZ5M23oBONNsalxIgEzOmBwo9f"
}
if (!$env:APPVEYOR_REPO_COMMIT)
{
	$env:APPVEYOR_REPO_COMMIT = "178ba9471ed93c8b8a63bda2331867bb60f83829"
}
if (!$env:APPVEYOR_REPO_BRANCH)
{
	$env:APPVEYOR_REPO_BRANCH = "master"
}
if (!$env:APPVEYOR_REPO_COMMIT_AUTHOR)
{
	$env:APPVEYOR_REPO_COMMIT_AUTHOR = "Harel Mazor"
}
if (!$env:APPVEYOR_REPO_COMMIT_MESSAGE)
{
	$env:APPVEYOR_REPO_COMMIT_MESSAGE = "Debug commit message!"
}
if (!$env:APPVEYOR_JOB_ID) 
{
	$env:APPVEYOR_JOB_ID = "JobID"
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
Write-Host "ng test --no-progress --code-coverage"
ng test --no-progress --code-coverage

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

# Locate coveralls

$CoverAlls = get-childitem "C:\Users\$($env:UserName)\.nuget\packages\" csmacnz.Coveralls.exe -recurse | select-object -first 1 | select -expand FullName

# Run coveralls

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER

$CoverAllsCmd = "$($CoverAlls) --multiple -i `"opencover=$OpenCoverAPICoverageFile;opencover=$OpenCoverDACoverageFile;lcov=$LcovCoverageFile`" --repoToken $env:COVERALLS_REPO_TOKEN --commitId $env:APPVEYOR_REPO_COMMIT --commitBranch $env:APPVEYOR_REPO_BRANCH --commitAuthor `"$env:APPVEYOR_REPO_COMMIT_AUTHOR`" --commitMessage `"$env:APPVEYOR_REPO_COMMIT_MESSAGE`" --jobId $env:APPVEYOR_JOB_ID --commitEmail none --useRelativePaths"
Write-Host $CoverAllsCmd
Invoke-Expression $CoverAllsCmd
if ($LastExitCode) {
	$anyFailures = $TRUE
}


if ($anyFailures -eq $TRUE){
    write-host "Failing build as there are broken tests"
    $host.SetShouldExit(1)
}


