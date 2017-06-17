"use strict";

var gulp = require("gulp");
var filter = require("gulp-filter");
var path = require("path");
var gettext = require("gulp-angular-gettext");

var paths = {
    webroot: "./wwwroot/"
};
paths.traslations = paths.webroot + "translations/";

gulp.task("extract_to_pot", function () {
    return gulp.src(["**/*.html", "**/*.js", "!node_modules/**", "!obj/**", "!bin/**"])
        .pipe(gettext.extract("IsraelHiking.pot", {}))
        .pipe(gulp.dest(paths.traslations));
});

gulp.task("compile_translations", function () {
    return gulp.src(paths.traslations + "*.po")
        .pipe(gettext.compile({ format: "json" }))
        .pipe(gulp.dest(paths.traslations));
});

gulp.task("default", ["build"]);