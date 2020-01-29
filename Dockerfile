FROM node:latest as build-node

WORKDIR /angular
COPY ./IsraelHiking.Web/ ./

RUN npm i && npm run build -- --no-progress

FROM mcr.microsoft.com/dotnet/core/sdk:3.1 as build-net

WORKDIR /net
COPY . .

RUN dotnet restore && dotnet build

WORKDIR /net/IsraelHiking.Web

RUN dotnet publish

From mcr.microsoft.com/dotnet/core/aspnet:3.1 as release

WORKDIR /israelhiking

COPY --from=build-net /net/IsraelHiking.Web/bin/Debug/netcoreapp3.1/publish ./
COPY --from=build-node /angular/wwwroot ./wwwroot

ENTRYPOINT ["dotnet", "IsraelHiking.Web.dll"]