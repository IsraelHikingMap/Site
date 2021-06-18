# Intro
This repository holds all the files that the site needs in order to run.

[![AppVeyor](https://img.shields.io/appveyor/ci/IsraelHikingHost/site/master.svg)](https://ci.appveyor.com/project/IsraelHikingHost/site)
[![AppVeyor tests](https://img.shields.io/appveyor/tests/IsraelHikingHost/site/master.svg)](https://ci.appveyor.com/project/IsraelHikingHost/site/build/tests)
[![Codecov](https://img.shields.io/codecov/c/github/israelhikingmap/site/master.svg)](https://codecov.io/gh/IsraelHikingMap/Site/list/master/)

## Contents
* [Technology stack](#technology-stack)
* [Architecture and folder stucture of UI](#architecture-and-folder-stucture-of-ui)
* [Architecture of Server](#architecture-of-server)
* [Setting Up the Project for Development](#setting-up-the-project-for-development)
* [Starting a debug session](#starting-a-debug-session)
* [Setup the server](#setup-the-server)

# Technology stack
The technology stack of this site is based on the following frameworks:
* [Typescript](http://www.typescriptlang.org/)
* [Angular](https://angular.io/)
* [Angular-Material](https://material.angular.io/)
* [MapLibre](https://docs.maplibre.org/)
* [ngx-maplibre-gl](https://github.com/maplibre/ngx-maplibre-gl/)
* [Jasmine](http://jasmine.github.io/) + [Karma](https://karma-runner.github.io/) - for unit testing.
* [Asp.Net core](https://docs.microsoft.com/en-us/aspnet/core/)
* [NSubstitute](http://nsubstitute.github.io/)
* [GraphHopper](https://graphhopper.com/)
* [Elastic Search and NEST](https://www.elastic.co/)
* [Net Topology Suite](https://github.com/NetTopologySuite/NetTopologySuite)
* [OsmSharp](http://www.osmsharp.com/)
* [Wikipedia using Wiki client library](https://github.com/CXuesong/WikiClientLibrary) Wikipedia and upload images to Wikimedia common
* [Imgur](https://imgur.com/) - Used for uploading anonymous images
* [Cordova](https://cordova.apache.org/) - Used to wrap the site as a mobile application and add some native capabilities
* [Redux using angular-redux](https://github.com/angular-redux/platform)
* [Dexie](https://dexie.org/) - Used for client side storage
* [Docker](https://www.docker.com/)

# Architecture and folder stucture of UI
The architecture is based heavily on Angular:
* application - where all the application code is, topmost folder.
  * components - this layer handles the UI calls and bindings along with the relevant css and html files.
  * directives - folder for all the directives.
  * models - used to store data types that are common to the entire app.
  * reducers - used for redux reducers, actions and payloads.
  * services - this layer holds the lower level data handling.
    * layers - where the layers logic is - POI, route, wiki, nakeb, relevant services, etc...
* content - used for images and static content.
* environments - used for angular-cli to define production and dev variables.
* fonts - [icomoon](https://icomoon.io/app/) generated font for icons instead of images.
* scss - used for global style files
* translations - all relevant data related to i18n.
 
# Architecture of Server
The architecture is based on layers:
* Contollers - the topmost layer to catch all the requests
* Services - responsible for orchestrating executors
* Converters - converters logic between types of geo structures
* Executers - basic logical building blocks
* DataAccessInterfaces - a slim layer to decouple business logic from data access
* DataAccess - database, file system and network request are processed in this layer
* Common - Mainly for POCOs

# Setting Up the Project for site Development (To setup iOS and Android follow the cordova guide)
In order to be able to build this site you'll need some tools:
* Install [Docker](https://www.docker.com/products/docker-desktop)
* Install [.Net core SDK 5.0 ](https://www.microsoft.com/net/download/core)
* Install [node.js](https://nodejs.org/en/) (14.17+).
* Run from command line `dotnet restore` and after that `dotnet build`
* Go to `IsraelHiking.Web` and run from command line: 
  * `npm install` to install all npm packages for the client side code
  * `npm run build` to generate the Angular UI client. It should create `wwwroot` folder on a successful run
* Run `docker compose up graphhopper` - it should fail for the first time
* Run `gh-update.ps1` (set chmod +x if needed) to generate the graphhopper routing data
* Run `docker compose up` to load the rest of the sercives
* Run `dotnet run --project IsraelHiking.Web --launch_profile IsraelHiking.Web`
* If you want to update the translations or upload images from your debug environment, you'll need to add the following secrets to `IsraelHiking.Web`. Otherwise, skip this step.    
  <img width="397" alt="2017-10-22 10_47_32-" src="https://user-images.githubusercontent.com/1304610/31860867-3b283092-b72a-11e7-8119-fe04ecd13852.png">    
  In the `secrets.json` at the end there should be these fields.
  ```
  {
    "wikiMediaUserName": "your wikimedia user",
    "wikiMediaPassword": "your wikimedia password"
    "zanataUserName": "your zanata user",
    "zanataApiKey": "your zanata api key",
    "imgurClientId": "your imgur clinet ID"
  }
  ```

# Starting a debug session
[See the relevant page in our wiki](https://github.com/IsraelHikingMap/Site/wiki/Debug-Environment-Setup)

