# Intro
This repository holds all the files that the site needs in order to run.

[![Build status](https://ci.appveyor.com/api/projects/status/38up550uh57s8khw/branch/master?svg=true)](https://ci.appveyor.com/project/HarelM/site/branch/master)
[![Test status](http://teststatusbadge.azurewebsites.net/api/status/HarelM/site)](https://ci.appveyor.com/project/HarelM/site)
[![Coverage Status](https://coveralls.io/repos/github/IsraelHikingMap/Site/badge.svg?branch=master)](https://coveralls.io/github/IsraelHikingMap/Site?branch=master)

# Technology stack
The technology stack of this site is base on the following frameworks:
* [Typescript](http://www.typescriptlang.org/)
* [AngularJS](https://angularjs.org/)
* [Leaflet](http://leafletjs.com/)
* [Jasmine](http://jasmine.github.io/) + [Chutzpah](https://chutzpah.codeplex.com/) + [PhantomJS](http://phantomjs.org/) - for unit testing.
* [Asp.Net Web Api](http://www.asp.net/web-api)
* [NSubstitute](http://nsubstitute.github.io/)
* [Sqlite](https://www.sqlite.org/)
* [GraphHopper](https://graphhopper.com/)
* [Elastic Search and NEST](https://www.elastic.co/)
* [Net Topology Suite](https://github.com/NetTopologySuite/NetTopologySuite)
* [OsmSharp](http://www.osmsharp.com/)


# Architecture and folder stucture of UI
The architecture is based heavily on AngularJS:
* common - used to store data types that are common to the entire app.
* content - used for third party css files and images.
* controllers - this layer handles the UI calls and bindings along with the relevant css and html files.
* directives - folder for all the directives.
* scripts - third party javascipt libraries used in this project.
* services - this layer hold the lower level data handling.
 * layers - where the layers logic is - POI, route, wiki, layersService
 * elevation - elevation services to know what altitude a point has
 * parsers - parses files and converts them form string to data model objects and back
 * routers - handles the routing - currently there are 4 routers - hike, bike, fourbyfour and none.
 * search - facilitates the search control
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
* Download and install the [LTS version of Node.js](https://nodejs.org/en/) for Windows.
  * Notice and save the node.js installation directory. It is usually ```C:\Program Files\nodejs\```
* Download and install [Visual Studio community 2017](https://www.visualstudio.com/downloads) or later.
* From Visual Studio's _Tools &rarr; Options..._
  * Go to _Projects and Solutions &rarr; External Web Tools_.
  * Add the above node.js installation directory as a new directory.
  * Using the up arrow, move the node.js installation directory up to the second place in the list - just after ```.\node_modules\.bin```.
  * Click _OK_ to close the dialog.
  * Exit Visual Studio and re-open it.
* From Visual Studio's _Tools &rarr; Extensions and Updates..._ 
  * Go to _Online_
  * Search for the following and install them: 
    * Web Essentials 2017
    * Chutzpah Test Adapter for the test explorer
    * Chutzpah Test Runner Contet Menu Extension

# Setup the server
In order to be able to make the server work a few prerequisits are needed:
* Windows machine with IIS enabled and a site.
* Install Java Runtime Environment.
* As administrator run IsraelHiking.Updater.exe - this will create a services to run Graph Hopper and Elastic Search so it will always be up.
* Add a task to windows scheduler as administrator to run the updater as administrator once a day or so to update the routing and search.

###IsraelHiking.Updater.exe
This utility is used to download and update the OSM data for the search and routing.
This utility also setups the services needed for the machine.
The following flags can be used when running from commnad line:

```-d```: don't download latest OSM pbf file from geofabrik

```-g```: don't update graphhopper data

```-e```: don't update elastic search data

```-h```: for the help menu
