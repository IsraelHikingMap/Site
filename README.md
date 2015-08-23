# Intro
This repository holds all the files that the site needs in order to run.

# Technology stack
The technology stack of this site is base on the following frameworks:
* [Typescript](http://www.typescriptlang.org/)
* [AngularJS](https://angularjs.org/)
* [Leaflet](http://leafletjs.com/)
* [Jasmine](http://jasmine.github.io/) + [Chutzpah](https://chutzpah.codeplex.com/) + [PhantomJS](http://phantomjs.org/) - for unit testing.

# Architecture and folder stucture
The architecture is based heavily on AngularJS:
* common - used to store data types that are common to the entire app.
* content - used for css files and images.
* controllers - this layer handles the UI calls and bindings.
* directives - folder for all the directives.
* scripts - third level javascipt libraries used in this project.
* services - this layer hold the lower level data handling.
 * parsers - parses files and converts them form string to dta model objects and back
 * routers - handles the routing - currently there are 4 routers - hike, bike, fourbyfour and none.
* views - represents the UI - all HTML should be placed there
 
# Setting up this project
In order to be able to see this site you'll need some tools:
* Download and install [Visual Studio 2015](https://www.visualstudio.com/en-us/downloads/download-visual-studio-vs.aspx) or later.
* Using nuget install/update the following: TypeScript, Web Essentials, Chutzpah (both runner and context menu).