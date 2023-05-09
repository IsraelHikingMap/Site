"use strict";

import open from "open";
import fs from "fs";
import FromData from "form-data";
import https from "https";
import md5File from "md5-file";
import { GettextExtractor, JsExtractors } from "gettext-extractor";

var guid = "a21e53dc-017c-42f4-be3d-5dbe7eaf9433";
var secretsFile = process.platform.startsWith("win")
    ? process.env.APPDATA + `\\Microsoft\\UserSecrets\\${guid}\\secrets.json`
    : process.env.HOME + `/.microsoft/usersecrets/${guid}/secrets.json`
if (fs.existsSync(secretsFile)) {
    var nonPublic = JSON.parse(fs.readFileSync(secretsFile, 'utf-8'));
} else {
    throw new Error("The following file is needed: " + secretsFile + "\n" +
        "see 'https://github.com/IsraelHikingMap/Site/wiki/Adding-New-Text-and-Updating-the-Translations' for more information");
}
var potFilePath = "./src/translations/IsraelHiking.pot";

// Extract to POT:
var extractor = new GettextExtractor();
extractor.createJsParser([
    JsExtractors.callExpression("[this].gettextCatalog.getString",
        {
            arguments: {
                text: 0,
                context: 1
            }
        })
]).parseFilesGlob("./src/**/*.@(ts|js|tsx|jsx)");

extractor.savePotFile(potFilePath);

extractor.printStats();

// upload file:

let form = new FromData();
form.append("file", fs.createReadStream(potFilePath));
form.append("first", "true");
form.append("last", "true");
form.append("type", "GETTEXT");
form.append("hash", md5File.sync(potFilePath));

const req = https.request("https://translate.zanata.org/rest/file/source/IsraelHiking/Main?docId=IsraelHiking", {
    method: "POST",
    headers: {
        ...form.getHeaders(),
        "X-Auth-User": nonPublic.zanataUserName,
        "X-Auth-Token": nonPublic.zanataApiKey,
    },
}, (res) => {
    res.on("data", () => {});
    res.on("end", () => {
        console.log("Upload successful! opening browser so you can start translating :-)");
        open("https://translate.zanata.org/webtrans/translate?project=IsraelHiking&iteration=Main&localeId=en-US&locale=en-US#view:doc;doc:IsraelHiking;untranslated:show;fuzzy:show;rejected:show");
    });
});
req.on("error", (err) => console.error("Upload failed: ", err));

form.pipe(req);
