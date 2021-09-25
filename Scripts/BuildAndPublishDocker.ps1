Write-Host "Building $env:APPVEYOR_BUILD_VERSION docker image"

docker build . -t israelhikingmap/website:$env:APPVEYOR_BUILD_VERSION --build-arg VERSION=$env:APPVEYOR_BUILD_VERSION

Write-Host "Login and push"

docker login --username $env:DOCKERHUB_USER --password $env:DOCKERHUB_TOKEN

docker push israelhikingmap/website:$env:APPVEYOR_BUILD_VERSION