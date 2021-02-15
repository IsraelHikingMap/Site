/**
 * This file is used to remove permission from the android manufest file for cordova in order to reduce the required permissions
 */

var permissionsToRemove = [ "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS", "RECEIVE_BOOT_COMPLETED", "READ_PHONE_STATE"];

console.log("Removing unneeded permissions: " + permissionsToRemove.join(", "));

var fs = require('fs');
var path = require('path');
var rootdir = "";
var manifestFile = path.join(rootdir, "platforms/android/app/src/main/AndroidManifest.xml");

fs.readFile(manifestFile, "utf8", (err, data) => {
    if (err) {
        return console.log(err);
    }

    var result = data;
    for (let permission of permissionsToRemove) {
        result = result.replace("<uses-permission android:name=\"android.permission." + permission + "\"/>", "");
    }
    fs.writeFile(manifestFile, result, "utf8", (err) => {
        if (err) { 
            return console.log(err);
        }
    });
});