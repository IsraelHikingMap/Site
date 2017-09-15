import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { ApplicationModule } from "./application/application.module";
import { environment } from "./environments/environment";
import "hammerjs";

if (environment.production) {
  enableProdMode();
}
platformBrowserDynamic().bootstrapModule(ApplicationModule);
