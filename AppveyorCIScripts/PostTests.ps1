$BreakPoints =  Get-PSBreakpoint
$User = "appveyor"
if ($BreakPoints)
{
	# set a breakpoint anywhere in the file to run this locally...
	$User = "harel"
}

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

# Compile Typescript files

$tsc = get-childitem "C:\Program Files (x86)\" tsc.exe -recurse | select-object -last 1 | select -expand FullName

Write-Host $tsc "-p IsraelHiking.Web"
& $tsc -p IsraelHiking.Web

Write-Host $tsc "-p Tests\IsraelHiking.Web.Tests"
& $tsc -p Tests\IsraelHiking.Web.Tests

# Locate Chutzpah

$ChutzpahJUnitFile = "$($env:APPVEYOR_BUILD_FOLDER)\chutzpah-junit.xml"
$ChutzpahCoverageFile = "$($env:APPVEYOR_BUILD_FOLDER)\coverage-chutzpah.json"

$Chutzpah = get-childitem "C:\Users\$($User)\.nuget\packages\" chutzpah.console.exe -recurse | select-object -first 1 | select -expand FullName

# Run tests using Chutzpah and export results as JUnit format and chutzpah coveragejson for coverage

$ChutzpahCmd = "$($Chutzpah) $($env:APPVEYOR_BUILD_FOLDER)\chutzpah.json /junit $ChutzpahJUnitFile /coverage /coveragejson $ChutzpahCoverageFile"
Write-Host $ChutzpahCmd
Invoke-Expression $ChutzpahCmd

# Upload results to AppVeyor one by one
$testsuites = [xml](get-content $ChutzpahJUnitFile)

$anyFailures = $FALSE
foreach ($testsuite in $testsuites.testsuites.testsuite) {
    write-host " $($testsuite.name)"
    foreach ($testcase in $testsuite.testcase){
        $failed = $testcase.failure
        $time = $testsuite.time
        if ($testcase.time) { $time = $testcase.time }
        if ($failed) {
            write-host "Failed   $($testcase.name) $($testcase.failure.message)"
            Add-AppveyorTest $testcase.name -Outcome Failed -FileName $testsuite.name -ErrorMessage $testcase.failure.message -Duration $time
            $anyFailures = $TRUE
        }
        else {
            write-host "Passed   $($testcase.name)"
            Add-AppveyorTest $testcase.name -Outcome Passed -FileName $testsuite.name -Duration $time
        }
    }
}

# Locate Files

$OpenCover = get-ChildItem "C:\Users\$($User)\.nuget\packages\" OpenCover.Console.exe -recurse | select-object -first 1 | select -expand FullName
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

# Upload test resutls
$wc = New-Object 'System.Net.WebClient'
$wc.UploadFile("https://ci.appveyor.com/api/testresults/mstest/$($env:APPVEYOR_JOB_ID)", $OpenCoverAPIResultsFile)
$wc.UploadFile("https://ci.appveyor.com/api/testresults/mstest/$($env:APPVEYOR_JOB_ID)", $OpenCoverDAResultsFile)

# Locate coveralls

$CoverAlls = get-childitem "C:\Users\$($User)\.nuget\packages\" csmacnz.Coveralls.exe -recurse | select-object -first 1 | select -expand FullName

# Run coveralls

$CoverAllsCmd = "$($CoverAlls) --multiple -i `"opencover=$OpenCoverAPICoverageFile;opencover=$OpenCoverDACoverageFile;chutzpah=$ChutzpahCoverageFile`" --repoToken $env:COVERALLS_REPO_TOKEN --commitId $env:APPVEYOR_REPO_COMMIT --commitBranch $env:APPVEYOR_REPO_BRANCH --commitAuthor `"$env:APPVEYOR_REPO_COMMIT_AUTHOR`" --commitMessage `"$env:APPVEYOR_REPO_COMMIT_MESSAGE`" --jobId $env:APPVEYOR_JOB_ID --commitEmail none --useRelativePaths"
Write-Host $CoverAllsCmd
Invoke-Expression $CoverAllsCmd
# Running the same command twice as a workaround
Invoke-Expression $CoverAllsCmd


if ($anyFailures -eq $TRUE){
    write-host "Failing build as there are broken tests"
    $host.SetShouldExit(1)
}


