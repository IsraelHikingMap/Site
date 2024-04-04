"use strict";

import fs from "fs";

const resourcesFilePath = "./src/application/services/resources.service.ts";
const sourceFile = "./src/application/services/resources.service.ts";
import targetJson from "./src/translations/en-US.json" assert { type: "json" };

const fileContent = fs.readFileSync(sourceFile, "utf-8");
const jsonKeys = fileContent.replace(/\"\s*\+\s*\"/g, "")
    .split("\n")
    .filter(line => line.includes("getString(\""))
    .join("\n")
    .replace(/.*getString\(\"(.*)\"\);?/g, "$1")
    .split("\n")
    .sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));

const output = {};
for (let key of jsonKeys) {
    if (!Object.keys(targetJson).includes(key)) {
        output[key] = key;
    } else {
        output[key] = targetJson[key];
    }
}


console.log("Updating translation file");
fs.writeFileSync("./src/translations/en-US.json", JSON.stringify(output, null, 4));

console.log("Updating translation signature");
const data = fs.readFileSync(resourcesFilePath, "utf8");
const result = data.replace(/(\.json\?sign=)(.*)"/g, "$1" + new Date().getTime().toString() + '"');
fs.writeFileSync(resourcesFilePath, result);