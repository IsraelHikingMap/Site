$OpenCoverLogger = "/logger:Appveyor"
$breakPoints =  Get-PSBreakpoint
if ($breakPoints)
{
	# set a breakpoint anywhere in the file to run this locally...
	$OpenCoverLogger = ""
}
$OpenCoverCoverageFile = "coverage-opencover.xml"
$ChutzpahJUnitFile = "chutzpah-junit.xml"
$ChutzpahCoverageFile = "coverage-chutzpah.json"
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

Set-Location -Path "C:\Users\appveyor\.nuget\packages\"

# Locate Chutzpah

$ChutzpahDir = get-childitem chutzpah.console.exe -recurse | select-object -first 1 | select -expand Directory

# Run tests using Chutzpah and export results as JUnit format and chutzpah coveragejson for coverage

$ChutzpahCmd = "$($ChutzpahDir)\chutzpah.console.exe $($env:APPVEYOR_BUILD_FOLDER)\chutzpah.json /junit $ChutzpahJUnitFile /coverage /coveragejson $ChutzpahCoverageFile"
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

# Locate OpenCover

$OpenCoverDir = get-childitem OpenCover.Console.exe -recurse | select-object -first 1 | select -expand Directory

# Run OpenCover

$OpenCoverCmd = "$($OpenCoverDir)\OpenCover.Console.exe -register:user -target:`"C:\Program Files (x86)\Microsoft Visual Studio 14.0\Common7\IDE\CommonExtensions\Microsoft\TestWindow\vstest.console.exe`" -targetargs:`"$OpenCoverLogger $($env:APPVEYOR_BUILD_FOLDER)\Tests\IsraelHiking.API.Tests\bin\Debug\IsraelHiking.API.Tests.dll $($env:APPVEYOR_BUILD_FOLDER)\Tests\IsraelHiking.DataAccess.Tests\bin\Debug\IsraelHiking.DataAccess.Tests.dll`" -filter:`"+[*]*API* +[*]*Database* +[*]*GPSBabel* -[*]*JsonResponse* -[*]*GpxTypes* -[*]*Tests*`" -excludebyattribute:`"*.ExcludeFromCodeCoverage*`" -output:$OpenCoverCoverageFile"
Write-Host $OpenCoverCmd
Invoke-Expression $OpenCoverCmd

# Locate coveralls

$CoverAllsDir = get-childitem csmacnz.Coveralls.exe -recurse | select-object -first 1 | select -expand Directory

# Run coveralls

$CoverAllsCmd = "$($CoverAllsDir)\csmacnz.Coveralls.exe --multiple -i `"opencover=$OpenCoverCoverageFile;chutzpah=$ChutzpahCoverageFile`" --repoToken $env:COVERALLS_REPO_TOKEN --commitId $env:APPVEYOR_REPO_COMMIT --commitBranch $env:APPVEYOR_REPO_BRANCH --commitAuthor `"$env:APPVEYOR_REPO_COMMIT_AUTHOR`" --commitMessage `"$env:APPVEYOR_REPO_COMMIT_MESSAGE`" --jobId $env:APPVEYOR_JOB_ID --commitEmail none --useRelativePaths"
Write-Host $CoverAllsCmd
Invoke-Expression $CoverAllsCmd

if ($anyFailures -eq $TRUE){
    write-host "Failing build as there are broken tests"
    $host.SetShouldExit(1)
}


