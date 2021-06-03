Write-Host "Building latest docker image"

docker build . -t israelhikingmap/website:latest --build-arg VERSION=$env:APPVEYOR_BUILD_VERSION

Write-Host "Login and push"

docker login --username $env:DOCKERHUB_USER --password $env:DOCKERHUB_TOKEN

docker push israelhikingmap/website:latest

if ($env:APPVEYOR_REPO_TAG -eq "true")
{
    Write-Host "Adding version $env:APPVEYOR_BUILD_VERSION tag"
    
    docker tag israelhikingmap/website:latest israelhikingmap/website:$env:APPVEYOR_BUILD_VERSION

    Write-Host "Pushing version $env:APPVEYOR_BUILD_VERSION tag and pushing"
    docker push israelhikingmap/website:$env:APPVEYOR_BUILD_VERSION
}