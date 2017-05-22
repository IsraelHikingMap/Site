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
* [Jasmine](http://jasmine.github.io/) + [Chutzpah](https://chutzpah.codeplex.com/) + [PhantomJS](http://phantomjs.org/) - for unit testing.
* [Asp.Net core](https://docs.microsoft.com/en-us/aspnet/core/)
* [NSubstitute](http://nsubstitute.github.io/)
* [Sqlite](https://www.sqlite.org/)
* [GraphHopper](https://graphhopper.com/)
* [Elastic Search and NEST](https://www.elastic.co/)
* [Net Topology Suite](https://github.com/NetTopologySuite/NetTopologySuite)
* [OsmSharp](http://www.osmsharp.com/)


# Architecture and folder stucture of UI
The architecture is based heavily on Angular:
* Application - where all the is, top most folder.
  * common - used to store data types that are common to the entire app.
  * content - used for images, mainly favicon.
  * components - this layer handles the UI calls and bindings along with the relevant css and html files.
  * directives - folder for all the directives.
  * services - this layer hold the lower level data handling.
    * layers - where the layers logic is - POI, route, wiki, layersService, etc...
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
* Updater will be discussed below.  

# Setting up this project
In order to be able to build this site you'll need some tools:

* Download and install [Visual Studio community 2017](https://www.visualstudio.com/downloads) or later. Select:
  * ASP.NET and web development
  * .NET cross-platform development
* Install [node.js](https://nodejs.org/en/) for windows (6.10+)
* Follow [these steps](http://stackoverflow.com/questions/43849585/update-node-version-in-visual-studio-2017) to update the version of node.js Visual Studio uses
* If you don't have any other preference, choose "General" development settings
* Temporary step for using local versions of OsmSharp and NetTopologySuite
  * Open the `TempLocalNugets` directory under the Site reposotory location
  * View &rarr; Other Windows... &rarr; Package Manager Console
  * For each of the files in `TempLocalNugets`
    * Shift-Right-Click &rarr; Copy as path
    * Go back to VS package manager console (At the bottom pane) and type `Install-Package` followed by `Ctrl-V` and `Enter`. For example:
      ```
      PM> Install-Package "C:\GitHub\IsraelHikingMap\Site\TempLocalNugets\NetTopologySuite.IO.1.15.0-IHM.nupkg"
      ```
* From Visual Studio's _Tools &rarr; Extensions and Updates..._ 
  * Go to _Online_
  * Search for the following and install them: 
    * Web Essentials 2017
    * Chutzpah Test Adapter for the test explorer
    * Chutzpah Test Runner Contet Menu Extension
  * Restart Visual Studio to complete the installation
* Open IsraelHiking.sln and compile using F6 - Note that it will take time to download all the packages so be patience
* Change any character in packages.json file to trigger a download of all npm packages or go to the IsraelHiking.Web and run `npm install` from the command line - this will take a while as well.
* Open command prompt and execute `npm install -g @angular/cli@latest`
* `ng` commands should be avaliable from the command line.
* go to IsraelHiking.Web folder and execute `ng build` which will fill the `wwwroot` folder 
* In Package Manager Console
  * Select IsraelHiking.DataAccess from the Default project dropdown.
  * ```
      PM> Update-Database
      ```
  * This should create a israelHiking.sqlite file in the binaries folder of IsraelHiking.Web project.
* Press F5 to run the site.

# Setup the server
In order to be able to make the server work a few prerequisits are needed:
* Windows machine with IIS enabled and a site.
* Install Java Runtime Environment.
* As administrator, create a task to run the Graph Hopper and Elastic Search services and update them.
  * Open Windows' Task Scheduler using "run as Administrator"
  * Create task 
  * Add an action
  
      <img width="340" alt="Create Task screenshot" src="https://cloud.githubusercontent.com/assets/1304610/24397580/581fecb8-13af-11e7-9388-e3741fcc52bd.png">

      where "Start in" is the full pathname of the `sraelHiking.Updater\bin\Debug\netcoreapp1.1` directory
  * Add a "On a schedule" trigger to run once a day or at the frequency of the map updates.
  * Add a "At startup" trigger.
* Add a task to windows scheduler as administrator to run the updater as administrator once a day or so to update the routing and search.

###dotnet IsraelHiking.Updater.dll
This utility is used to download and update the OSM data for the search and routing.
This utility also setups the services needed for the machine.
The following flags can be used when running from commnad line:

`-d | --download`: download latest OSM pbf file from geofabrik

`-g | --graphhopper`: update graphhopper data

`-e | -es | --elasticsearch`: update elastic search data

`-? | -h | --help`: for the help menu

When no flags are given all the above will be executed.
