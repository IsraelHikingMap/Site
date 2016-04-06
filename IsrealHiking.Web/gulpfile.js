/// <binding Clean='clean' />
"use strict";

var gulp = require("gulp"),
  rimraf = require("rimraf"),
  concat = require("gulp-concat"),
  cssmin = require("gulp-cssmin"),
  uglify = require("gulp-uglify"),
  filter = require("gulp-filter"),
  less = require("gulp-less"),
  mainBowerFiles = require("main-bower-files"),
  path = require("path");

var paths = {
    webroot: "./"
};
paths.scripts = paths.webroot + "scripts";
paths.content = paths.webroot + "content";
paths.images = paths.content + "/images";
paths.fonts = paths.webroot + "fonts";


var config = {
    sassPath: "./resources/sass",
    bowerDir: "./bower_components"
}

gulp.task("build", function () {

    var jsFilter = filter(["**/*.js"], { restore: true });
    var cssFilter = filter(["**/*.css"], { restore: true });
    var fontsFilter = filter("**/fonts/*.*", { restore: true });
    var pngFilter = filter("**/*.png", { restore: true });
    return gulp.src(mainBowerFiles())
        .pipe(jsFilter)
        .pipe(gulp.dest(paths.scripts))
        .pipe(jsFilter.restore)
        .pipe(cssFilter)
        .pipe(gulp.dest(paths.content))
        .pipe(cssFilter.restore)
        .pipe(fontsFilter)
        .pipe(gulp.dest(paths.fonts))
        .pipe(fontsFilter.restore)
        .pipe(pngFilter)
        .pipe(gulp.dest(paths.images))
        .pipe(pngFilter.restore);
});

gulp.task("default", ["build"]);