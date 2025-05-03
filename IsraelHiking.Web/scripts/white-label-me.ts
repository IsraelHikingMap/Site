import { MobileProject } from '@trapezedev/project';
import type { MobileProjectConfig } from '@trapezedev/project';
import fs from 'fs';

const config: MobileProjectConfig = {
    ios: {
        path: 'ios/App',
    },
    android: {
        path: 'android',
    },
};

let appName = "My New App";
const appId = 'com.123.app';
const version = '1.2.34';
const buildNumber = 1234;
const websiteUrl = 'www.somthing.com';

function updateCapacitorConfigFile() {
    const configPath = 'capacitor.config.ts';
    let configFile = fs.readFileSync(configPath, 'utf8');

    // Example: replace appId and appName dynamically
    configFile = configFile
    .replace(/appId: ['"`](.*?)['"`]/, `appId: '${appId}'`)
    .replace(/appName: ['"`](.*?)['"`]/, `appName: '${appName}'`);

    fs.writeFileSync(configPath, configFile);
}

async function updateAndroidFiles(project: MobileProject) {
    await project.android?.setPackageName(appId);
    await project.android?.setVersionName(version);
    await project.android?.setVersionCode(buildNumber);
    await project.android?.getResourceXmlFile("res/values/strings.xml")?.setAttrs("package_name", appId);
    await project.android?.getResourceXmlFile("res/values/strings.xml")?.setAttrs("plugin_bgloc_account_type", appId + "account");
    await project.android?.getResourceXmlFile("res/values/strings.xml")?.setAttrs("app_name", appName);
    const appBuildGradleFile = await project.android?.getGradleFile('app/build.gradle');
    await appBuildGradleFile?.setApplicationId(appId);
    await appBuildGradleFile?.setNamespace(appId);
    for (const intentFilter of project.android?.getAndroidManifest().find('manifest/application/activity/intent-filter/data')) {
        if (intentFilter.getAttribute('android:host') === "israelhiking.osm.org.il") {
            intentFilter.setAttribute('android:host', websiteUrl);
        }
    }
}

async function updateIosFiles(project: MobileProject) {
    await project.ios?.setBundleId(null, "Release", appId);
    await project.ios?.setDisplayName(null, "Release", appName);
    await project.ios?.setBuild(null, "Release", version);
    await project.ios?.setVersion(null, "Release", version);
}


///// Main function to run the script //////
updateCapacitorConfigFile();
const project = new MobileProject('.', config);
await project.load();
updateAndroidFiles(project);
updateIosFiles(project);
await project.commit();

