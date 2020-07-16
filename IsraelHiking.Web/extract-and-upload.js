"use strict";

var open = require("open");
var fs = require("fs");
var request = require("request");
var md5File = require("md5-file");
const { GettextExtractor, JsExtractors } = require("gettext-extractor");

var guid = "a21e53dc-017c-42f4-be3d-5dbe7eaf9433";
var secretsFile = process.platform.startsWith("win")
    ? process.env.APPDATA + `\\Microsoft\\UserSecrets\\${guid}\\secrets.json`
    : process.env.HOME + `/.microsoft/usersecrets/${guid}/secrets.json`
if (fs.existsSync(secretsFile)) {
    var nonPublic = require(secretsFile);
} else {
    throw new Error("The following file is needed: " + secretsFile + "\n" +
        "see 'https://github.com/IsraelHikingMap/Site/wiki/Adding-New-Text-and-Updating-the-Translations' for more information");
}
var potFilePath = "./sources/translations/IsraelHiking.pot";

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
]).parseFilesGlob("./sources/**/*.@(ts|js|tsx|jsx)");

extractor.savePotFile(potFilePath);

extractor.printStats();

// upload file:
request({
    url: "https://translate.zanata.org/rest/file/source/IsraelHiking/Main?docId=IsraelHiking",
    formData: {
        file: fs.createReadStream(potFilePath),
        first: "true",
        last: "true",
        type: "GETTEXT",
        hash: md5File.sync(potFilePath)
    },
    headers: {
        "X-Auth-User": nonPublic.zanataUserName,
        "X-Auth-Token": nonPublic.zanataApiKey
    },
    method: "POST"
}, (err) => {
    if (err) {
        return console.error("Upload failed: ", err);
    }
    console.log("Upload successful! opening browser so you can start translating :-)");
        open("https://translate.zanata.org/webtrans/translate?project=IsraelHiking&iteration=Main&localeId=en-US&locale=en-US#view:doc;doc:IsraelHiking;untranslated:show;fuzzy:show;rejected:show");
});
