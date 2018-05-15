$apiUrl = 'https://ci.appveyor.com/api'
$staging = "Staging"

Set-Location (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent)
"Setting location to script directory"
pwd

"Getting project details"
$project = Invoke-RestMethod -Method Get -Uri "$apiUrl/projects/israelhikinghost/site"
$jobId = $project.build.jobs[0].jobId
"Got job id: $jobId"

"Getting job artifacts"
$artifacts = Invoke-RestMethod -Method Get -Uri "$apiUrl/buildjobs/$jobId/artifacts"
$artifactFileName = $artifacts[0].fileName
"Got the artifact file name: $artifactFileName"

"Cleaning staging folder"
Remove-Item -Path $staging -Recurse
New-Item -Path $staging -ItemType directory

$localArtifactPath = "$staging\$artifactFileName"
"Downloading artifact to: $localArtifactPath"
Invoke-RestMethod -Method Get -Uri "$apiUrl/buildjobs/$jobId/artifacts/$artifactFileName" -OutFile $localArtifactPath

Set-Location -Path $staging
"Finished downloading, extracting file"
& "C:\Program Files\7-zip\7z.exe" x $artifactFileName

"Deleting zip file"
Remove-Item $artifactFileName

Set-Location (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent)
"Bringing the site down"
Stop-WebAppPool -Name "IsraelHiking.osm.org.il"

while ((Get-WebAppPoolState -Name "IsraelHiking.osm.org.il").Value -ne "Stopped") {
  "Waiting 1 second for site to stop..."
  Start-Sleep -s 1
}

"Deleting old wwwroot folder"
Remove-Item -Path "israelhiking.osm.org.il\wwwroot" -Recurse  

"Deploying site files"
Copy-Item "$staging\*" -Destination "israelhiking.osm.org.il" -Force -Recurse

"Bringing the site up"
Start-WebAppPool -Name "IsraelHiking.osm.org.il"

"Site deploy finished! Press any key to continue..."
cmd /c Pause | Out-Null