FROM node:22.13 AS build-node

WORKDIR /angular
COPY ./IsraelHiking.Web/ ./

RUN npm ci
RUN npm run build:prod -- --no-progress

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build-net
ARG VERSION=9.20.0
WORKDIR /net
COPY . .

WORKDIR /net/IsraelHiking.Web

RUN echo "Building version $VERSION" && dotnet publish -p:"Version=$VERSION;AssemblyVersion=$VERSION"

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS release

RUN apt-get update -y --allow-unauthenticated --allow-insecure-repositories && apt-get install -y curl

WORKDIR /israelhiking

COPY --from=build-net /net/IsraelHiking.Web/bin/Release/net9.0/publish ./
COPY --from=build-node /angular/wwwroot ./wwwroot

HEALTHCHECK --interval=5s --timeout=3s --start-period=40s CMD curl --fail http://localhost:80/api/health || exit 1

EXPOSE 80

ENTRYPOINT ["dotnet", "IsraelHiking.Web.dll"]