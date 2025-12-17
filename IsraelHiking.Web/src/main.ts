import { enableProdMode } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";

import { environment } from "./environments/environment";
import { appConfig } from "./application/app.config";
import { MainMapComponent } from "./application/components/map/main-map.component";

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

bootstrapApplication(MainMapComponent, appConfig);
