import { enableProdMode, provideZoneChangeDetection } from "@angular/core";
import { environment } from "./environments/environment";
import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./application/app.config";
import { AppRootComponent } from "./application/components/screens/app-root.component";

// See https://github.com/ionic-team/capacitor/issues/1564
export class FileReaderFixForCapacitor extends FileReader {
    constructor() {
        super();
        // eslint-disable-next-line
        const zoneOriginalInstance = (this as any).__zone_symbol__originalInstance;
        return zoneOriginalInstance || this;
    }
}
window.FileReader = FileReaderFixForCapacitor;

if (environment.production) {
    enableProdMode();
}

bootstrapApplication(AppRootComponent, { ...appConfig, providers: [provideZoneChangeDetection(), ...appConfig.providers] });
