import { MobileProject } from '@trapezedev/project';
import type { MobileProjectConfig } from '@trapezedev/project';

const config: MobileProjectConfig = {
    ios: {
        path: 'ios/App',
    },
    android: {
        path: 'android',
    },
};

let appName = "Israel Hiking Map";
const appId = 'com.123.app';
const version = '1.2.34';
const buildNumber = 1234;
const websiteUrl = 'https://www.somthing.com';

const project = new MobileProject('.', config);
await project.load();

await project.android?.setPackageName(appId);
await project.android?.setVersionName(version);
await project.android?.setVersionCode(buildNumber);
const appBuildGradleFile = await project.android?.getGradleFile('app/build.gradle');
await appBuildGradleFile?.setApplicationId(appId);
await appBuildGradleFile?.setNamespace(appId);
for (const intentFilter of project.android?.getAndroidManifest().find('manifest/application/activity/intent-filter/data')) {
    if (intentFilter.getAttribute('android:host') === "israelhiking.osm.org.il") {
        intentFilter.setAttribute('android:host', websiteUrl);
    }
}

await project.ios?.setBundleId(null, "Release", appId);
await project.ios?.setDisplayName(null, "Release", appName);
await project.ios?.setBuild(null, "Release", version);
await project.ios?.setVersion(null, "Release", version);

await project.commit();

