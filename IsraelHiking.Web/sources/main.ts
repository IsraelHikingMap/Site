/// <reference types="cordova" />
/// <reference types="cordova-plugin-inappbrowser" />
import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { ApplicationModule } from "./application/application.module";
import { environment } from "./environments/environment";
import "hammerjs";

declare var StatusBar: any;

if (environment.production) {
    enableProdMode();
}

if (environment.isCordova) {
    let onDeviceReady = () => {
        window.open = cordova.InAppBrowser.open;
        StatusBar.overlaysWebView(true);
        StatusBar.overlaysWebView(false);
        bootstrapInitializationFunction();
    };
    document.addEventListener("deviceready", onDeviceReady, false);
} else {
    bootstrapInitializationFunction();
}

// the following is needed for AOT to work correctly: https://github.com/angular/angular-cli/issues/11218
function bootstrapInitializationFunction() {
    platformBrowserDynamic().bootstrapModule(ApplicationModule);
}
