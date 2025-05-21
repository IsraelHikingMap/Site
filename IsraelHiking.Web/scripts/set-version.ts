import { MobileProject } from "@trapezedev/project";
import type { MobileProjectConfig } from "@trapezedev/project";

const config: MobileProjectConfig = {
    ios: {
        path: "ios/App",
    },
    android: {
        path: "android",
    },
};

if (process.argv.length < 4) {
    console.error("Usage: npm run set-version -- <version> <build-number>");
    console.error("Example: npm run set-version -- 9.20.0 920000");
    process.exit(1);
}

const version = process.argv[2] || "9.20.0";
const buildNumber = +process.argv[3] || 920000;

console.log(`Setting version to ${version} and build number to ${buildNumber}`);

const project = new MobileProject(".", config);
await project.load();
await project.android?.setVersionName(version);
await project.android?.setVersionCode(buildNumber);
for (const bundleName of ["Debug", "Release"]) {
    await project.ios?.setBuild(null, bundleName, version);
    await project.ios?.setVersion(null, bundleName, version);
}
await project.commit();

console.log(`Version set to ${version} and build number set to ${buildNumber}`);