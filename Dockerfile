FROM node:latest as build-node

WORKDIR /tmp
COPY ./IsraelHiking.Web/package.json ./IsraelHiking.Web/package-lock.json ./

RUN npm i 

COPY /IsraelHiking.Web/ ./
RUN npm run build -- --no-progress

FROM mcr.microsoft.com/dotnet/core/sdk:3.0 as release

WORKDIR /usr/app
COPY . .

RUN dotnet restore && dotnet build

COPY --from=build-node /tmp/wwwroot ./IsraelHiking.Web/wwwroot

WORKDIR /usr/app/IsraelHiking.Web

CMD dotnet run --no-build --no-restore