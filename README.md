# Intro
This repository holds all the files that the site needs in order to run.

[![Build status](https://ci.appveyor.com/api/projects/status/38up550uh57s8khw/branch/master?svg=true)](https://ci.appveyor.com/project/HarelM/site/branch/master)
[![Test status](http://teststatusbadge.azurewebsites.net/api/status/HarelM/site)](https://ci.appveyor.com/project/HarelM/site)

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
* [Elastic Search](https://www.elastic.co/)


# Architecture and folder stucture of UI
The architecture is based heavily on AngularJS:
* common - used to store data types that are common to the entire app.
* content - used for css files and images.
* controllers - this layer handles the UI calls and bindings.
* directives - folder for all the directives.
* scripts - third level javascipt libraries used in this project.
* services - this layer hold the lower level data handling.
 * drawing - where the drawing markers and routes logic is
 * elevation - elevation services to know what altitude a point has
 * parsers - parses files and converts them form string to data model objects and back
 * routers - handles the routing - currently there are 4 routers - hike, bike, fourbyfour and none.
 * search - facilitates the search control
* views - represents the UI - all HTML should be placed there
 
# Architecture of Server
The architecture is based on layers
* Contollers - the top most layer to catch all the requests
* Services - other logic used by controllers
* DataAccessInterfaces - a slim layer to decouple business logic from data access
* DataAccess - database, file system and network request are processed in this layer
* Updater will be discussed below.  

# Setting up this project
In order to be able to see this site you'll need some tools:
* Download and install [Visual Studio 2015](https://www.visualstudio.com/en-us/downloads/download-visual-studio-vs.aspx) or later.
* Using nuget install/update the following: TypeScript, Web Essentials, Chutzpah (both runner and context menu).

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