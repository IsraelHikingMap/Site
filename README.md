# Intro
This repository holds all the files that the site needs in order to run.

[![Build status](https://ci.appveyor.com/api/projects/status/38up550uh57s8khw/branch/master?svg=true)](https://ci.appveyor.com/project/HarelM/site/branch/master)
[![Test status](http://teststatusbadge.azurewebsites.net/api/status/HarelM/site)](https://ci.appveyor.com/project/HarelM/site)
[![Coverage Status](https://coveralls.io/repos/github/IsraelHikingMap/Site/badge.svg?branch=master)](https://coveralls.io/github/IsraelHikingMap/Site?branch=master)

# Technology stack
The technology stack of this site is base on the following frameworks:
* [Typescript](http://www.typescriptlang.org/)
* [Angular](https://angular.io/)
* [Angular-Material](https://material.angular.io/)
* [Leaflet](http://leafletjs.com/)
* [Jasmine](http://jasmine.github.io/) + [Karma](https://karma-runner.github.io/) - for unit testing.
* [Asp.Net core](https://docs.microsoft.com/en-us/aspnet/core/)
* [NSubstitute](http://nsubstitute.github.io/)
* [Sqlite](https://www.sqlite.org/)
* [GraphHopper](https://graphhopper.com/)
* [Elastic Search and NEST](https://www.elastic.co/)
* [Net Topology Suite](https://github.com/NetTopologySuite/NetTopologySuite)
* [OsmSharp](http://www.osmsharp.com/)


# Architecture and folder stucture of UI
The architecture is based heavily on Angular:
* application - where all the is, top most folder.
  * common - used to store data types that are common to the entire app.
  * content - used for images, mainly favicon.
  * components - this layer handles the UI calls and bindings along with the relevant css and html files.
  * directives - folder for all the directives.
  * services - this layer hold the lower level data handling.
    * layers - where the layers logic is - POI, route, wiki, nakeb, relevant services, etc...
    * routers - handles the routing - currently there are 4 routers - hike, bike, fourbyfour and none.
* fonts - icomoon generated font for icons instead of images.
* Environments - used for angular-cli to define production and dev variables.
* translations - all relevant data related to i18n
 
# Architecture of Server
The architecture is based on layers
* Contollers - the top most layer to catch all the requests
* Services - responible for orchastrating executors
* Converters - converters logic between types of geo structures
* Executers - basic logical building blocks 
* DataAccessInterfaces - a slim layer to decouple business logic from data access
* DataAccess - database, file system and network request are processed in this layer

# Setting Up the Project for Development
In order to be able to build this site you'll need some tools:
* Install [Java runtime](https://java.com/en/download/) - make sure to install 64bit version.
* Download and install [Visual Studio community 2017](https://www.visualstudio.com/downloads) or later. Select:
  * ASP.NET and web development
  * .NET cross-platform development
* Install [node.js](https://nodejs.org/en/) for windows (6.10+). Use the recommended 64-bit installer on modern Windows versions.
* Open Visual Studio
* Follow [these steps](http://stackoverflow.com/questions/43849585/update-node-version-in-visual-studio-2017) to update the version of node.js Visual Studio uses
* If asked, and you don't have any other preference, choose "General" development settings
* In Visual Studio, _File &rarr; Open &rarr; Project/Solution..._ and choose the `IsraelHiking.sln` solution from the Site reposotory location.
* From Visual Studio's _Tools &rarr; Extensions and Updates..._ 
  * Go to _Online_
  * Search for the following and `Download` them: 
    * Web Essentials 2017
  * Exit Visual Studio to complete the installation
  * Find the `VSIX Installer` window and click _Modify_, wait for the installation to complete, and close it
  * Open Visual Studio, wait for the installations to complete, and restart when asked
* Open `IsraelHiking.sln`. You may use _File &rarr; Recent Projects and Solutions_
* Compile using `Ctrl-Shift-B` - Note that it will take time to download all the packages so be patience
* Place a `nonPublic.json` at `D:\Dropbox\IsraelHikingGithub` (or change the `appsetting.json` nonPublic property to a file containineg the following json)
```
{
	wikiMediaUserName: "your wikimedia user",
	wikiMediaPassword: "your wikimedia password"
}
```
* In Visual Studio, _View &rarr; Other Windows... &rarr; Package Manager Console_
  * Select IsraelHiking.DataAccess from the Default project dropdown
  * Type the following commands at the `PM>` prompt. Most of the commands may take a while. Ignore all _WARN_ messsages.
  ```
  npm install -g @angular/cli@latest --loglevel error
  Update-Database
  ```
# Starting a debug session
[See the relevant page in our wiki](https://github.com/IsraelHikingMap/Site/wiki/Debug-Environment-Setup)

# Setup the server
In order to be able to make the server work a few prerequisits are needed:
* Windows machine with IIS enabled and a site (Although this site should be able to run on Linux it was never fully tested).
* Install Java Runtime Environment.
* Add `curl` to path.
* `ElasticSearch.cmd` and `GraphHopper.cmd` should be processes that run when the server machine starts and never die - use a watchdog or windows service to make sure they do (we use NSSM. for linux, check the java command inside those files and use a deamon to run them).
* Place the israelhiking.sqlite file along side the dlls and make sure the user that runs the server has write access to it (IIS user for windows).
* Create a task to update Graph Hopper and Elastic Search:
  * Open Windows' Task Scheduler
  * Create task
  * Add an action to run `UpdateDB.bat` after you download a new osm.pbf file.
  * Add a "On a schedule" trigger to run once a day or at the frequency of the map updates.
  * Add a "At startup" trigger.
