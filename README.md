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
The technology stack of this site is base on the following frameworks:
* [Typescript](http://www.typescriptlang.org/)
* [Angular](https://angular.io/)
* [Angular-Material](https://material.angular.io/)
* [Mapbox-gl-js](https://docs.mapbox.com/mapbox-gl-js/api/)
* [ngx-mapbox-gl](https://wykks.github.io/ngx-mapbox-gl/)
* [Jasmine](http://jasmine.github.io/) + [Karma](https://karma-runner.github.io/) - for unit testing.
* [Asp.Net core](https://docs.microsoft.com/en-us/aspnet/core/)
* [NSubstitute](http://nsubstitute.github.io/)
* [GraphHopper](https://graphhopper.com/)
* [Elastic Search and NEST](https://www.elastic.co/)
* [Net Topology Suite](https://github.com/NetTopologySuite/NetTopologySuite)
* [OsmSharp](http://www.osmsharp.com/)
* [Wikipedia using Wiki client library](https://github.com/CXuesong/WikiClientLibrary) Wikipedia and upload images to Wikimedia common
* [Imgur](https://imgur.com/) - Used for uploadling anonymous images
* [Cordova](https://cordova.apache.org/) - Used to wrap the site as a mobile application and add some native capabilities
* [Redux using angular-redux](https://github.com/angular-redux/platform)
* [Dexie](https://dexie.org/) - Used for client side storage
* [Docker](https://www.docker.com/)

# Architecture and folder stucture of UI
The architecture is based heavily on Angular:
* application - where all the is, topmost folder.
  * components - this layer handles the UI calls and bindings along with the relevant css and html files.
  * directives - folder for all the directives.
  * models - used to store data types that are common to the entire app.
  * reducers - used for redux reducers, actions and payloads.
  * services - this layer hold the lower level data handling.
    * layers - where the layers logic is - POI, route, wiki, nakeb, relevant services, etc...
* content - used for images and static content.
* environments - used for angular-cli to define production and dev variables.
* fonts - [icomoon](https://icomoon.io/app/) generated font for icons instead of images.
* scss - used for global style files
* translations - all relevant data related to i18n
 
# Architecture of Server
The architecture is based on layers
* Contollers - the topmost layer to catch all the requests
* Services - responsible for orchastrating executors
* Converters - converters logic between types of geo structures
* Executers - basic logical building blocks
* DataAccessInterfaces - a slim layer to decouple business logic from data access
* DataAccess - database, file system and network request are processed in this layer
* Common - Mainly for POCOs

# Setting Up the Project for Development (Windows)
In order to be able to build this site you'll need some tools:
* Install [Java runtime](https://java.com/en/download/) - make sure to install 64bit version.
* Install [Docker](https://www.docker.com/products/docker-desktop)
* Download and install [Visual Studio community 2019](https://www.visualstudio.com/downloads) or later. Select:
  * ASP.NET and web development
  * .NET cross-platform development
* [.Net core SDK 3.1 ](https://www.microsoft.com/net/download/core)
* Install [node.js](https://nodejs.org/en/) for windows (10.1+). Use the recommended 64-bit installer on modern Windows versions.
* Open Visual Studio
* Follow [these steps](https://stackoverflow.com/a/43850262/368683) to update the version of node.js Visual Studio uses
* If asked, and you don't have any other preference, choose "General" development settings
* In Visual Studio, _File &rarr; Open &rarr; Project/Solution..._ and choose the `IsraelHiking.sln` solution from the Site reposotory location.
* From Visual Studio's _Tools &rarr; Extensions and Updates..._ 
  * Go to _Online_
  * Search for the following and `Download` them: 
    * Web Essentials 2019
  * Exit Visual Studio to complete the installation
  * Find the `VSIX Installer` window and click _Modify_, wait for the installation to complete, and close it
  * Open Visual Studio, wait for the installations to complete, and restart when asked
* Open `IsraelHiking.sln`. You may use _File &rarr; Recent Projects and Solutions_
* Compile using `Ctrl-Shift-B` - Note: please be patient as it will take time to download all the packages.
* Go to `IsraelHiking.Web` and run from command line: 
  * `npm install` to install all npm packages for the client side code
  * `npm run build` to generate the Angular UI client. It should create `wwwroot` folder on a successful run
* If you want to update the translations or upload images from your debug environment, right-click on `IsraelHiking.Web` and select `Manage User Secrets`. Otherwise, skip this step.    
  <img width="397" alt="2017-10-22 10_47_32-" src="https://user-images.githubusercontent.com/1304610/31860867-3b283092-b72a-11e7-8119-fe04ecd13852.png">    
  In the `secrets.json` file that opens add the applicable fields and save the file.
  ```
  {
    "wikiMediaUserName": "your wikimedia user",
    "wikiMediaPassword": "your wikimedia password"
    "zanataUserName": "your zanata user",
    "zanataApiKey": "your zanata api key",
    "imgurClientId": "your imgur clinet ID",
    "offlineFilesFolder": "a folder path for offline files"
  }
  ```

# Starting a debug session
[See the relevant page in our wiki](https://github.com/IsraelHikingMap/Site/wiki/Debug-Environment-Setup)

# Setup the server
In order to be able to make the server work a few prerequisits are needed:
* Windows machine with IIS enabled and a site (Although this site should be able to run on Linux it was never fully tested).
* Install Java Runtime Environment.
* Add `curl` to path.
* For graphhoper routing see instructions here: https://github.com/IsraelHikingMap/graphhopper-docker
* Create a task to rebuild Elastic Search:
  * Open Windows' Task Scheduler
  * Create task
  * Add an action to run `curl -k -X POST https://israelhiking.osm.org.il/api/update -d ""`
  * Add a "On a schedule" trigger to run once a day or at the frequency of the map updates.
* Create a task to update elastic search using the above steps with the action `curl -k -X PUT https://israelhiking.osm.org.il/api/update -d ""`
* Create a task to clean the IIS logs using `Scripts\CleanLogs.cmd`
