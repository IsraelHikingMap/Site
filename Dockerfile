ARG DOCKER_TAG=9.9.0
FROM node:latest as build-node

WORKDIR /angular
COPY ./IsraelHiking.Web/ ./

RUN npm i && npm run build -- --no-progress

FROM mcr.microsoft.com/dotnet/sdk:5.0 as build-net

WORKDIR /net
COPY . .

RUN if [ "$DOCKER_TAG" = "latest" ] ; then \
    dotnet restore && dotnet build; \
    else \
    dotnet restore && dotnet build -p:"Version=${DOCKER_TAG:1};AssemblyVersion=${DOCKER_TAG:1}"; \
    fi

WORKDIR /net/IsraelHiking.Web

RUN dotnet publish

FROM mcr.microsoft.com/dotnet/aspnet:5.0 as release

WORKDIR /israelhiking

COPY --from=build-net /net/IsraelHiking.Web/bin/Debug/netcoreapp5.0/publish ./
COPY --from=build-node /angular/wwwroot ./wwwroot

ENTRYPOINT ["dotnet", "IsraelHiking.Web.dll"]