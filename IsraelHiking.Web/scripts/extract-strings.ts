"use strict";

import fs from "fs";

const resourcesFilePath = "./src/application/services/resources.service.ts";
const sourceFile = "./src/application/services/resources.service.ts";

const fileContent = fs.readFileSync(sourceFile, "utf-8");
const jsonKeys = fileContent.replace(/\"\s*\+\s*\"/g, "")
    .split("\n")
    .filter(line => line.includes("getString(\""))
    .join("\n")
    .replace(/.*getString\(\"(.*)\"\);?/g, "$1")
    .split("\n")
    .sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));


const translationFiles = fs.readdirSync("./src/translations");
for (let translationFile of translationFiles) {
    const output: Record<string, string> = {};
    for (let key of jsonKeys) {
        const targetJson = JSON.parse(fs.readFileSync(`./src/translations/${translationFile}`, "utf-8"));
        if (!Object.keys(targetJson).includes(key)) {
            if (translationFile === "en-US.json") {
                output[key] = key;
            } else {
                output[key] = "__MISSING__";
            }
        } else {
            output[key] = targetJson[key];
        }
    }
    console.log("Updating translation file " + translationFile);
    fs.writeFileSync(`./src/translations/${translationFile}`, JSON.stringify(output, null, 4));
}



console.log("Updating translation signature");
const data = fs.readFileSync(resourcesFilePath, "utf8");
const result = data.replace(/(\.json\?sign=)(.*)"/g, "$1" + new Date().getTime().toString() + '"');
fs.writeFileSync(resourcesFilePath, result);