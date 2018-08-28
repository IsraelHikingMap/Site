import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { ApplicationModule } from "./application/application.module";
import { environment } from "./environments/environment";
import "hammerjs";

declare var cordova: any;

if (environment.production) {
    enableProdMode();
}
if (environment.isCordova) {
    let onDeviceReady = () => {
        window.open = cordova.InAppBrowser.open;
        platformBrowserDynamic().bootstrapModule(ApplicationModule);
    };
    document.addEventListener("deviceready", onDeviceReady, false);
} else {
    platformBrowserDynamic().bootstrapModule(ApplicationModule);
}
