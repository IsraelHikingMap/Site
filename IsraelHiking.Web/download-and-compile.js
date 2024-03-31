"use strict";

import https from "https";
import fs from "fs";
import po2json from "po2json";

var englishFilePath = "./src/translations/en-Us.po";
var hebrewFilePath = "./src/translations/he.po";
var resourcesFilePath = "./src/application/services/resources.service.ts";

function downloadAndProcess(languageCode, filePath) {
    console.log(`Downloading ${languageCode} translation`);
    https.get(`https://translate.zanata.org/rest/file/translation/IsraelHiking/Main/${languageCode}/po?docId=IsraelHiking`,
        (response) => {
        const englishStream = response.pipe(fs.createWriteStream(filePath));
            englishStream.on("finish",
                () => {
                    po2json.parseFile(filePath,
                        { pretty: true, format: "mf" },
                        (_, json) => {
                            for (let key in json) {
                                json[key] = json[key].replace(":-)", "😊");
                                json[key] = json[key].replace(":-(", "😞");
                            }
                            const jsonFilePath = filePath.replace(".po", ".json");
                            fs.writeFileSync(jsonFilePath, JSON.stringify(json, null, 4));
                            console.log("Finished translation compilation to JSON " + jsonFilePath);
                        });
                });
            });
}

downloadAndProcess("he", hebrewFilePath);
downloadAndProcess("en-US", englishFilePath);

console.log("Updating translation signature");
fs.readFile(resourcesFilePath,
    "utf8",
    (err, data) => {
        if (err) {
            return;
        }
        const result = data.replace(/(\.json\?sign=)(.*)"/g, "$1" + new Date().getTime().toString() + '"');
        fs.writeFile(resourcesFilePath, result, "utf8", () => { });
    });

