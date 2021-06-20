import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { ApplicationModule } from "./application/application.module";
import { environment } from "./environments/environment";

declare let cordova: any;

if (environment.production) {
    enableProdMode();
}

// HM TODO: check if this is still relevant
// the following is needed for AOT to work correctly: https://github.com/angular/angular-cli/issues/11218
const bootstrapInitializationFunction = () => {
    platformBrowserDynamic().bootstrapModule(ApplicationModule);
};

if (environment.isCordova) {
    let onDeviceReady = () => {
        window.open = cordova.InAppBrowser.open;
        bootstrapInitializationFunction();
    };
    document.addEventListener("deviceready", onDeviceReady, false);
} else {
    bootstrapInitializationFunction();
}
