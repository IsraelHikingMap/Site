import { enableProdMode, provideZoneChangeDetection } from "@angular/core";
import { environment } from "./environments/environment";
import {
    bootstrapApplication,
    provideClientHydration,
    withEventReplay,
    withNoIncrementalHydration
} from "@angular/platform-browser";
import { provideMaplibreWorker } from "@maplibre/ngx-maplibre-gl/config"
import { appConfig } from "./application/app.config";
import { AppRootComponent } from "./application/components/screens/app-root.component";

if (environment.production) {
    enableProdMode();
}

bootstrapApplication(AppRootComponent, {
    ...appConfig,
    providers: [
        provideZoneChangeDetection(),
        ...appConfig.providers,
        provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
        provideMaplibreWorker("maplibre-gl-worker.mjs")
    ]
});
