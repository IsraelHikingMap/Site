import { MobileProject } from '@trapezedev/project';
import {replaceInFile} from 'replace-in-file'
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

const newAppId = 'this.is.the.app.id';
const oldAppId = 'il.org.osm.israelhiking';
const version = '1.2.34';
const buildNumber = 1234;
const oldWebsiteUrl = 'israelhiking.osm.org.il';
const newWebsiteUrl = 'www.the-app-url.com';

function searchAndReplaceInFiles() {
    replaceInFile({
        files: "**/*.*",
        from: new RegExp(oldAppName, 'g'),
        to: newAppName
    });
    replaceInFile({
        files: "**/*.*",
        from: new RegExp(oldAppId, 'g'),
        to: newAppId
    });
}

async function updateAndroidFiles(project: MobileProject) {
    await project.android?.setPackageName(newAppId);
    await project.android?.setVersionName(version);
    await project.android?.setVersionCode(buildNumber);
    await project.android?.getResourceXmlFile("res/values/strings.xml")?.setAttrs("package_name", appId);
    await project.android?.getResourceXmlFile("res/values/strings.xml")?.setAttrs("plugin_bgloc_account_type", appId + "account");
    await project.android?.getResourceXmlFile("res/values/strings.xml")?.setAttrs("app_name", appName);
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
    await project.ios?.setBundleId(null, "Release", newAppId);
    await project.ios?.setDisplayName(null, "Release", newAppName);
    await project.ios?.setBuild(null, "Release", version);
    await project.ios?.setVersion(null, "Release", version);
}


///// Main function to run the script //////
const project = new MobileProject('.', config);
await project.load();
await updateAndroidFiles(project);
await updateIosFiles(project);
//searchAndReplaceInFiles();
await project.commit();

