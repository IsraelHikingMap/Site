"use strict";

var gulp = require("gulp");
var filter = require("gulp-filter");
var path = require("path");
var gettext = require("gulp-angular-gettext");
var Builder = require('systemjs-builder');

var paths = {
    webroot: "./wwwroot/",
    node: "./node_modules/"
};
paths.external = paths.webroot + "external/";
paths.content = paths.webroot + "content";
paths.images = paths.content + "/images";
paths.fonts = paths.webroot + "fonts";
paths.traslations = paths.webroot + "translations/";
paths.angular = paths.node + "@angular/";

gulp.task("copy-rxjs", function () {
    return gulp.src([paths.node + "rxjs/**/*.js"], { base: paths.node }).pipe(gulp.dest(paths.external));
});

gulp.task("copy-local-storage", function () {
    return gulp.src([paths.node + "angular2-localstorage/dist/**/*.js"], { base: paths.node + "angular2-localstorage/dist" }).pipe(gulp.dest(paths.external + "angular2-localstorage"));
});

gulp.task("copy-angulartics2", function () {
    return gulp.src([paths.node + "angulartics2/dist/core.umd.js"])
        .pipe(gulp.dest(paths.external + "angulartics2"));
});

gulp.task("copy-to-external", ["copy-rxjs", "copy-local-storage", "copy-angulartics2"], function () {

    var jsFilter = filter(["**/*.js"], { restore: true });
    var cssFilter = filter(["**/*.css"], { restore: true });
    var fontsFilter = filter("**/fonts/*.*", { restore: true });
    var pngFilter = filter("**/*.png", { restore: true });
    var files = [
        paths.angular + "animations/bundles/animations.umd.js",
        paths.angular + "animations/bundles/animations-browser.umd.js",
        paths.angular + "core/bundles/core.umd.js",
        paths.angular + "common/bundles/common.umd.js",
        paths.angular + "compiler/bundles/compiler.umd.js",
        paths.angular + "platform-browser/bundles/platform-browser.umd.js",
        paths.angular + "platform-browser/bundles/platform-browser-animations.umd.js",
        paths.angular + "platform-browser-dynamic/bundles/platform-browser-dynamic.umd.js",
        paths.angular + "http/bundles/http.umd.js",
        paths.angular + "router/bundles/router.umd.js",
        paths.angular + "router/bundles/router-upgrade.umd.js",
        paths.angular + "forms/bundles/forms.umd.js",
        paths.angular + "upgrade/bundles/upgrade.umd.js",
        paths.angular + "upgrade/bundles/upgrade-static.umd.js",
        paths.angular + "material/bundles/material.umd.js",
        paths.angular + "material/prebuilt-themes/deeppurple-amber.css",
        paths.angular + "flex-layout/bundles/flex-layout.umd.js",
        paths.node + "angular-in-memory-web-api/bundles/in-memory-web-api.umd.js",
        paths.node + "ngx-clipboard/dist/bundles/ngxClipboard.umd.js",
        paths.node + "ngx-window-token/dist/bundles/ngxWindowToken.umd.js",
        paths.node + "jquery/dist/jquery.js",
        paths.node + "core-js/client/shim.min.js",
        paths.node + "zone.js/dist/zone.js",
        paths.node + "systemjs/dist/system.src.js",
        paths.node + "systemjs-plugin-css/css.js",
        paths.node + "systemjs-plugin-css/css-plugin-base.js",
        paths.node + "systemjs-plugin-css/css-plugin-base-builder.js",
        paths.node + "systemjs-plugin-css/postcss-bundle.js",
        paths.node + "leaflet/dist/leaflet.js",
        paths.node + "leaflet/dist/leaflet.css",
        paths.node + "leaflet.locatecontrol/src/L.Control.Locate.js",
        paths.node + "leaflet.markercluster/dist/leaflet.markercluster-src.js",
        paths.node + "leaflet.markercluster/dist/MarkerCluster.css",
        paths.node + "leaflet.markercluster/dist/MarkerCluster.Default.css",
        paths.node + "leaflet.gridlayer.googlemutant/Leaflet.GoogleMutant.js",
        paths.node + "file-saver/FileSaver.js",
        paths.node + "ng2-file-upload/bundles/ng2-file-upload.umd.js",
        paths.node + "lodash/lodash.js",
        paths.node + "x2js/x2js.js",
        paths.node + "osm-auth/osmauth.js"
    ];
    return gulp.src(files)
        .pipe(jsFilter)
        .pipe(gulp.dest(paths.external))
        .pipe(jsFilter.restore)
        .pipe(cssFilter)
        .pipe(gulp.dest(paths.external))
        .pipe(cssFilter.restore)
        .pipe(fontsFilter)
        .pipe(gulp.dest(paths.fonts))
        .pipe(fontsFilter.restore)
        .pipe(pngFilter)
        .pipe(gulp.dest(paths.images))
        .pipe(pngFilter.restore);
});

gulp.task("extract_to_pot", function () {
    return gulp.src(["**/*.html", "**/*.js", "!node_modules/**", "!bower_components/**", "!obj/**", "!bin/**"])
        .pipe(gettext.extract("IsraelHiking.pot", {}))
        .pipe(gulp.dest(paths.traslations));
});

gulp.task("compile_translations", function () {
    return gulp.src(paths.traslations + "*.po")
        .pipe(gettext.compile({ format: "json" }))
        .pipe(gulp.dest(paths.traslations));
});

gulp.task("bundle", function () {
    var builder = new Builder(paths.webroot, paths.webroot + "systemjs.config.js");
    // HM TODO: make this work
    builder.bundle("application/*", "../../DeployJs/application.js")
        .then(function () {
            console.log("Build application complete");
        })
        .catch(function (err) {
            console.log("Build application error");
            console.log(err);
        });
    builder.bundle("external/*", "../../DeployJs/external.js", { minify: true} )
        .then(function () {
            console.log("Build external complete");
        })
        .catch(function (err) {
            console.log("Build external error");
            console.log(err);
        });
});

gulp.task("default", ["build"]);