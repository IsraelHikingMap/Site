import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { ApplicationModule } from "./application/application.module";
import { environment } from "./environments/environment";
import "hammerjs";

declare var cordova: any;
declare var navigator: any;
declare var device: any;
if (environment.production) {
    enableProdMode();
}

if (environment.isCordova) {
    let onDeviceReady = () => {
        window.open = cordova.InAppBrowser.open;
        bootstrapInitializationFunction();
        let exitApp = false;
        let interval = setInterval(() => { exitApp = false; }, 5000);
        document.addEventListener("backbutton", (e) => {
            e.preventDefault();
            if (exitApp) {
                clearInterval(interval);
                if (navigator.app) {
                    navigator.app.exitApp();
                } else if (device) {
                    device.exitApp();
                }
            } else {
                exitApp = true;
                (window as any).plugins.toast.showShortBottom("Click back again to close the app");
                history.back();
            }
        }, false);
    };
    document.addEventListener("deviceready", onDeviceReady, false);
} else {
    bootstrapInitializationFunction();
}

// the following is needed for AOT to work correctly: https://github.com/angular/angular-cli/issues/11218
function bootstrapInitializationFunction() {
    platformBrowserDynamic().bootstrapModule(ApplicationModule);
}