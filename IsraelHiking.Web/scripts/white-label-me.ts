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

if (process.argv.length < 3) {
    console.error("Usage: npm run white-lable-me -- <version> <build-number>");
    console.error("Example: npm run white-lable-me -- 9.20.0 920000");
    console.error("Example: npm run white-lable-me -- 9.20.0 920000 mapeak");
    process.exit(1);
}

const version = process.argv[2] || '9.20.0';
const buildNumber = +process.argv[3] || 920000;

const oldAppName = "Israel Hiking Map";
const oldAppId = 'il.org.osm.israelhiking';
const oldWebsiteUrl = 'israelhiking.osm.org.il';

const newAppName = "Israel Hiking Map";
const newAppId = 'il.org.osm.israelhiking';
const newWebsiteUrl = 'israelhiking.osm.org.il';

if (process.argv[3] === 'mapeak') {
    const newAppName = "Mapeak";
    const newAppId = 'com.mapeak.www';
    const newWebsiteUrl = 'www.mapeak.com';
}

async function searchAndReplaceInFiles() {
    await replaceInFile({
        files: [
            "capacitor.config.ts", 
            "../**/Strings.cs", 
            "../**/Program.cs", 
            "**/metadata/**/*.*", 
            "**/Info.plist", 
            "**/*.html", 
            "**/translations/*.json", 
            "**/favicons/*.*",
            "**/*.service.ts"
        ],
        from: new RegExp(oldAppName, 'g'),
        to: newAppName
    });

    await replaceInFile({
        files: [
            "**/metadata/**/*.*",
            "**/*.html",
            "../**/robots.txt",
            "**/environments/environment.mobile.ts",
            "**/open-with.service.ts",
            "**/App.entitlements"
        ],
        from: new RegExp(oldWebsiteUrl.replace(/\./g, "\\."), 'g'),
        to: newWebsiteUrl
    });

    await replaceInFile({
        files: [
            "capacitor.config.ts", 
            "**/Appfile",
            "src/**/*.ts",
            "**/project.pbxproj",
            "../**/*.cs",
        ],
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

