$apiUrl = 'https://ci.appveyor.com/api'
$staging = "Staging"

Write-Host Geting project details
$project = Invoke-RestMethod -Method Get -Uri "$apiUrl/projects/israelhikinghost/site"
$jobId = $project.build.jobs[0].jobId
Write-Host Got job id: $jobId

Write-Host Geting job artifacts
$artifacts = Invoke-RestMethod -Method Get -Uri "$apiUrl/buildjobs/$jobId/artifacts"
$artifactFileName = $artifacts[0].fileName
Write-Host Got the artifact file name: $artifactFileName

Write-Host Cleaning staging folder
Remove-Item -Path $staging -Recurse
New-Item -Path $staging -ItemType directory

$localArtifactPath = "$staging\$artifactFileName"
Write-Host Downloading artifact to: $localArtifactPath
Invoke-RestMethod -Method Get -Uri "$apiUrl/buildjobs/$jobId/artifacts/$artifactFileName" -OutFile $localArtifactPath

Set-Location -Path $staging
Write-Host Finished downloading, extracting file
7z x $artifactFileName

Write-Host Deleting zip file
Remove-Item $artifactFileName

Set-Location -Path "..\"
Write-Host Copy app_offline.htm to bring the site down
Copy-Item "app_offline.htm" -Destination "israelhiking.osm.org.il\app_offline.htm"

Write-Host Deleting old wwwroot folder
Remove-Item -Path "israelhiking.osm.org.il\wwwroot" -Recurse  

Start-Sleep -s 5

Write-Host Deploying site files
Copy-Item "$staging\*" -Destination "israelhiking.osm.org.il" -Force -Recurse

Write-Host Delete app_offline.htm to bring the site up
Remove-Item "israelhiking.osm.org.il\app_offline.htm"