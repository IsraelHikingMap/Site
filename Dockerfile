ARG DOCKER_TAG=v9.9.0
FROM node:latest as build-node

WORKDIR /angular
COPY ./IsraelHiking.Web/ ./

RUN npm install
RUN npm run build -- --no-progress

FROM mcr.microsoft.com/dotnet/sdk:5.0.300 as build-net

WORKDIR /net
COPY . .

RUN dotnet restore

RUN if [ "$DOCKER_TAG" = "latest" ] || [ "$DOCKER_TAG" = "" ] ; then \
    echo "Building latest: $DOCKER_TAG" && dotnet build; \
    else \
    echo "Building version: ${DOCKER_TAG}" && dotnet build -p:"Version=${DOCKER_TAG:1};AssemblyVersion=${DOCKER_TAG:1}"; \
    fi

WORKDIR /net/IsraelHiking.Web

RUN dotnet publish

FROM mcr.microsoft.com/dotnet/aspnet:5.0 as release

RUN apt-get update -y --allow-unauthenticated --allow-insecure-repositories && apt-get install -y curl

WORKDIR /israelhiking

COPY --from=build-net /net/IsraelHiking.Web/bin/Debug/netcoreapp5.0/publish ./
COPY --from=build-node /angular/wwwroot ./wwwroot

ENTRYPOINT ["dotnet", "IsraelHiking.Web.dll"]