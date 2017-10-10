"use strict";

var gulp = require("gulp");
var filter = require("gulp-filter");
var fs = require("fs");
var gettext = require("gulp-angular-gettext");
var jsonFormat = require("gulp-json-format");
var upload = require("gulp-upload");
var md5File = require("md5-file");
var download = require("gulp-download-stream");
var open = require("gulp-open");
var appSettings = require("./appsettings.json");

if (fs.existsSync(appSettings.nonPublicConfigurationFilePath)) {
    var nonPublic = require(appSettings.nonPublicConfigurationFilePath);
} else {
    throw new Error("The following file is needed: " + appSettings.nonPublicConfigurationFilePath + "\n" +
        "the path is defined in appsettings.json file property: 'nonPublicConfigurationFilePath'\n" +
        "see 'https://github.com/IsraelHikingMap/Site/wiki/Adding-New-Text-and-Updating-the-Translations' for more information");
}

var potFileName = "IsraelHiking.pot";
var paths = {
    webroot: "./sources/"
};
paths.traslations = paths.webroot + "translations/";
paths.pot = paths.traslations + potFileName;

var uploadOptions = {
    server: "https://translate.zanata.org/rest/file/source/IsraelHiking/Main?docId=IsraelHiking",
    data: {
        dirname: paths.traslations,
        fileName: "IsraelHiking.pot",
        first: "true",
        last: "true",
        type: "GETTEXT",
        hash: function (file) {
            console.log("path: " + file.path);
            return md5File.sync(file.path);
        }
    },
    headers: {
        "X-Auth-User": nonPublic.zanataUserName,
        "X-Auth-Token": nonPublic.nonzanataApiKey
    },
    callback: function (err, data, res) {
        if (err) {
            console.log("error: " + err.toString());
        } else {
            console.log(data.toString());
        }
    }
}

gulp.task("extract_to_pot", function () {
    return gulp.src([paths.webroot + "**/*.html", paths.webroot + "**/*.ts", "!node_modules/**", "!obj/**", "!bin/**"])
        .pipe(gettext.extract(potFileName, {}))
        .pipe(gulp.dest(paths.traslations));
});

gulp.task("upload_translation", ["extract_to_pot"], function() {
    return gulp.src(paths.pot).pipe(upload(uploadOptions));
});

gulp.task("1_start_translating", ["upload_translation"], function () { //
    return gulp.src(__filename)
        .pipe(open({ uri: "https://translate.zanata.org/webtrans/translate?project=IsraelHiking&iteration=Main&localeId=en-US&locale=en-US&dswid=-5229#view:doc;doc:IsraelHiking;untranslated:show;fuzzy:show;rejected:show" }))
        .pipe(open({ uri: "https://translate.zanata.org/webtrans/translate?project=IsraelHiking&iteration=Main&localeId=he&locale=he&dswid=-5229#view:doc;doc:IsraelHiking;untranslated:show;fuzzy:show;rejected:show" }));
});

gulp.task("download_translation", function () {
    return download([
        {
            file: "en-US.po",
            url: "https://translate.zanata.org/rest/file/translation/IsraelHiking/Main/en-US/po?docId=IsraelHiking"
        }, {
            file: "he.po",
            url: "https://translate.zanata.org/rest/file/translation/IsraelHiking/Main/he/po?docId=IsraelHiking"
        }
    ]).pipe(gulp.dest(paths.traslations));
});

gulp.task("2_after_translation_finished", ["download_translation"], function () {
    return gulp.src(paths.traslations + "*.po")
        .pipe(gettext.compile({ format: "json" }))
        .pipe(jsonFormat(4))
        .pipe(gulp.dest(paths.traslations));
});