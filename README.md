# Intro
This repository holds all the files that the site needs in order to run.

# Technology stack
The technology stack of this site is base on the following frameworks:
* [Typescript](http://www.typescriptlang.org/)
* [AngularJS](https://angularjs.org/)
* [Leaflet](leafletjs.com/)

# Architecture
The architecture is designed according to AngularJS guide lines:
* UI - represented in views folder - all HTML should be placed there
* controllers - this layer handles the UI calls and bindings
* services - this layer hold the lower level data handling
 * parsers - parses files and converts them form string to dta model objects and back
 * routers - handles the routing - currently there are 4 routers - hike, bike, fourbyfour and none.

