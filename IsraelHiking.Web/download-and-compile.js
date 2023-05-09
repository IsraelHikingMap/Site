"use strict";

import https from "https";
import fs from "fs";
import po2json from "po2json";

var englishFilePath = "./src/translations/en-Us.po";
var hebrewFilePath = "./src/translations/he.po";
var resourcesFilePath = "./src/application/services/resources.service.ts";

console.log("Downloading English translation");
https.get("https://translate.zanata.org/rest/file/translation/IsraelHiking/Main/en-US/po?docId=IsraelHiking",
    (response) => {
        var englishStream = response.pipe(fs.createWriteStream(englishFilePath));
        englishStream.on("finish",
            () => {
                po2json.parseFile(englishFilePath,
                    { pretty: true, format: "mf" },
                    (_, json) => {
                        fs.writeFileSync(englishFilePath.replace(".po", ".json"), JSON.stringify(json, null, 4));
                        console.log("Finished English translation compilation to JSON");
                    });
            });
        console.log("Downloading Hebrew translation");
        https.get("https://translate.zanata.org/rest/file/translation/IsraelHiking/Main/he/po?docId=IsraelHiking",
            (response) => {
                var hebrewStream = response.pipe(fs.createWriteStream(hebrewFilePath));
                hebrewStream.on("finish",
                    () => {
                        po2json.parseFile(hebrewFilePath,
                            { pretty: true, format: "mf" },
                            (_, json) => {
                                fs.writeFileSync(hebrewFilePath.replace(".po", ".json"), JSON.stringify(json, null, 4));
                                console.log("Finished Hebrew translation compilation to JSON");
                            });
                    });
            });
        console.log("Updating translation signature");
        fs.readFile(resourcesFilePath,
            "utf8",
            (err, data) => {
                if (err) {
                    return;
                }
                var result = data.replace(/(\.json\?sign=)(.*)"/g, "$1" + new Date().getTime().toString() + '"');
                fs.writeFile(resourcesFilePath, result, "utf8", () => { });
            });
    });

