/**
 * System configuration for Angular samples
 * Adjust as necessary for your application needs.
 */

var systemJsPathAlias = {
    // paths serve as alias
    "npm:": "external/",
    "fonts:": "fonts/"
};

var systemJsMap = {
    // our app is within the app folder
    "application": "application",

    "css": "npm:css.js",
    // angular bundles
    "@angular/animations": "npm:animations.umd.js",
    "@angular/animations/browser": "npm:animations-browser.umd.js",
    "@angular/core": "npm:core.umd.js",
    "@angular/common": "npm:common.umd.js",
    "@angular/compiler": "npm:compiler.umd.js",
    "@angular/platform-browser": "npm:platform-browser.umd.js",
    "@angular/platform-browser/animations": "npm:platform-browser-animations.umd.js",
    "@angular/platform-browser-dynamic": "npm:platform-browser-dynamic.umd.js",
    "@angular/http": "npm:http.umd.js",
    "@angular/router": "npm:router.umd.js",
    "@angular/router/upgrade": "npm:router-upgrade.umd.js",
    "@angular/forms": "npm:forms.umd.js",
    "@angular/upgrade": "npm:upgrade.umd.js",
    "@angular/upgrade/static": "npm:upgrade-static.umd.js",
    "@angular/material": "npm:material.umd.js",
    "@angular/material-css": "npm:deeppurple-amber.css",
    "@angular/flex-layout": "npm:flex-layout.umd.js",
    
    // other libraries
    "rxjs": "npm:rxjs",
    "jquery": "npm:jquery.js",
    "angular-in-memory-web-api": "npm:in-memory-web-api.umd.js",
    "angular2-localstorage": "npm:angular2-localstorage",
    "angulartics2": "npm:angulartics2/core.umd.js",
    "ngx-clipboard": "npm:ngxClipboard.umd.js",
    "ngx-window-token": "npm:ngxWindowToken.umd.js",
    "leaflet": "npm:leaflet.js",
    "leaflet-css": "npm:leaflet.css",
    "leaflet.locatecontrol": "npm:L.Control.Locate.js",
    "leaflet.markercluster": "npm:leaflet.markercluster-src.js",
    "leaflet.markercluster-css": "npm:MarkerCluster.css",
    "leaflet.markercluster-default.css": "npm:MarkerCluster.Default.css",
    "leaflet.googlemutant": "npm:Leaflet.GoogleMutant.js",
    "file-saver": "npm:FileSaver.js",
    "ng2-file-upload": "npm:ng2-file-upload.umd.js",
    "lodash": "npm:lodash.js",
    "x2js": "npm:x2js.js",
    "osm-auth": "npm:osmauth.js",

    // site's css
    "icons-css": "fonts:icons.css", 
    "fontawesome-css": "fonts:font-awesome.min.css",
    "common-css": "common.css"
};

(function (global) {
    System.config({
        paths: systemJsPathAlias,
        // map tells the System loader where to look for things
        map: systemJsMap,
        // packages tells the System loader how to load when no filename and/or no extension
        packages: {
            application: {
                main: "./main.js",
                defaultExtension: "js",
                meta: {
                    "./*.js": {
                        loader: "systemjs-angular-loader.js"
                    }
                }
            },
            rxjs: {
                defaultExtension: "js"
            },
            "angular2-localstorage": {
                main: "./index.js", defaultExtension: "js"
            }
        },
        meta: {
            "*.css": {
                loader: "css"
            },
            "leaflet": {
                deps: ["leaflet-css"]
            },
            "leaflet.locatecontrol": {
                deps: ["leaflet"]
            },
            "leaflet.markercluster": {
                deps: ["leaflet.markercluster-css", "leaflet.markercluster-default.css"]
            },
            "@angular/material": {
                deps: ["@angular/material-css"]
            }
        }
    });
})(this);
