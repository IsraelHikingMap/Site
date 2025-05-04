import { MobileProject } from '@trapezedev/project';
import { replaceInFile } from 'replace-in-file'
import type { MobileProjectConfig } from '@trapezedev/project';

const config: MobileProjectConfig = {
    ios: {
        path: 'ios/App',
    },
    android: {
        path: 'android',
    },
};
const oldAppName = "Israel Hiking Map";
const newAppName = "__APP_NAME__";

const newAppId = 'that.is.the.app.id';
const oldAppId = 'il.org.osm.israelhiking';
const version = '1.2.34';
const buildNumber = 1234;
const oldWebsiteUrl = 'israelhiking.osm.org.il';
const newWebsiteUrl = 'www.the-app-url.com';

async function searchAndReplaceInFiles() {
    await replaceInFile({
        files: ["capacitor.config.ts"],
        from: new RegExp(oldAppName, 'g'),
        to: newAppName
    });
    await replaceInFile({
        files: ["capacitor.config.ts", "**/Appfile"],
        from: new RegExp(oldAppId, 'g'),
        to: newAppId
    });
}

async function updateAndroidFiles(project: MobileProject) {
    await project.android?.setPackageName(newAppId);
    await project.android?.setVersionName(version);
    await project.android?.setVersionCode(buildNumber);
    const stringsFile = await project.android?.getResourceXmlFile("values/strings.xml");
    await stringsFile.load();
    for (let element of stringsFile.find("resources/string")) {
        if (element.getAttribute('name') === 'app_name') {
            element.textContent = newAppName;
        }
        if (element.getAttribute('name') === 'plugin_bgloc_account_type') {
            element.textContent = newAppId + ".account";
        }
        if (element.getAttribute('name') === 'package_name') {
            element.textContent = newAppId;
        }
    }
    await project.android?.getResourceXmlFile("res/values/strings.xml")?.setAttrs("plugin_bgloc_account_type", newAppId + "account");
    await project.android?.getResourceXmlFile("res/values/strings.xml")?.setAttrs("app_name", newAppName);
    const appBuildGradleFile = await project.android?.getGradleFile('app/build.gradle');
    await appBuildGradleFile?.setApplicationId(newAppId);
    await appBuildGradleFile?.setNamespace(newAppId);
    for (const intentFilter of project.android?.getAndroidManifest().find('manifest/application/activity/intent-filter/data')) {
        if (intentFilter.getAttribute('android:host') === oldWebsiteUrl) {
            intentFilter.setAttribute('android:host', newWebsiteUrl);
        }
    }
}

async function updateIosFiles(project: MobileProject) {
    for (const bundleName of ["Debug", "Release"]) {
        await project.ios?.setBundleId(null, bundleName, newAppId);
        await project.ios?.setDisplayName(null, bundleName, newAppName);
        await project.ios?.setBuild(null, bundleName, version);
        await project.ios?.setVersion(null, bundleName, version);
    }
}


///// Main function to run the script //////
const project = new MobileProject('.', config);
await project.load();
await updateAndroidFiles(project);
await updateIosFiles(project);
await searchAndReplaceInFiles();
await project.commit();

