import { enableProdMode, provideZonelessChangeDetection } from "@angular/core";
import { environment } from "./environments/environment";
import {
    bootstrapApplication,
    provideClientHydration,
    withEventReplay,
    withNoHttpTransferCache,
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
        provideZonelessChangeDetection(),
        ...appConfig.providers,
        // The http transfer cache is keyed by the absolute url, and prerendering resolves relative
        // urls against its own origin, so its entries can never be matched by the browser. Turning
        // it off drops the unusable copy of the translations from every prerendered page.
        provideClientHydration(withEventReplay(), withNoIncrementalHydration(), withNoHttpTransferCache()),
        provideMaplibreWorker("maplibre-gl-worker.mjs")
    ]
});
