import { enableProdMode, provideZoneChangeDetection } from "@angular/core";
import { environment } from "./environments/environment";
import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./application/app.config";
import { AppRootComponent } from "./application/components/screens/app-root.component";

if (environment.production) {
    enableProdMode();
}

bootstrapApplication(AppRootComponent, { ...appConfig, providers: [provideZoneChangeDetection(), ...appConfig.providers] });
