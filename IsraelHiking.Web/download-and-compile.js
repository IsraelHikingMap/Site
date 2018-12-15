"use strict";

var https = require("https");
var fs = require("fs");
var po2json = require("po2json");

var englishFilePath = "./sources/translations/en-Us.po";
var hebrewFilePath = "./sources/translations/he.po";

console.log("Downloading English translation");
https.get("https://translate.zanata.org/rest/file/translation/IsraelHiking/Main/en-US/po?docId=IsraelHiking",
    (response) => {
        var englishStream = response.pipe(fs.createWriteStream(englishFilePath));
        englishStream.on("finish", () => {
            po2json.parseFile(englishFilePath,
                { pretty: true, format: "mf" },
                (_, json) => {
                    fs.writeFile(englishFilePath.replace(".po", ".json"), JSON.stringify(json, null, 4));
                    console.log("Finished English translation compilation to JSON");
                });
        });
        console.log("Downloading Hebrew translation");
        https.get("https://translate.zanata.org/rest/file/translation/IsraelHiking/Main/he/po?docId=IsraelHiking", (response) => {
            var hebrewStream = response.pipe(fs.createWriteStream(hebrewFilePath));
            hebrewStream.on("finish", () => {
                po2json.parseFile(hebrewFilePath,
                    { pretty: true, format: "mf" },
                    (_, json) => {
                        fs.writeFile(hebrewFilePath.replace(".po", ".json"), JSON.stringify(json, null, 4));
                        console.log("Finished Hebrew translation compilation to JSON");
                    });
            });
        });
    });

