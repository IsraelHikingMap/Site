FROM node:8.9.3 as build-node

WORKDIR /tmp
COPY ./IsraelHiking.Web/package.json ./IsraelHiking.Web/package-lock.json ./

RUN npm i 

COPY /IsraelHiking.Web/ ./
RUN npm run build -- --target=development --environment=dev --no-progress

FROM microsoft/dotnet:1.1-sdk as release

WORKDIR /usr/app
COPY . .

RUN dotnet restore && dotnet build

COPY --from=build-node /tmp/wwwroot ./IsraelHiking.Web/wwwroot

WORKDIR /usr/app/IsraelHiking.Web

CMD dotnet run --no-build --no-restore