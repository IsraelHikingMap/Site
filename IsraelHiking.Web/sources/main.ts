import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { WEBSTORAGE_CONFIG } from "ngx-store";
import { ApplicationModule } from "./application/application.module";
import { environment } from "./environments/environment";

if (environment.production) {
  enableProdMode();
}
platformBrowserDynamic().bootstrapModule(ApplicationModule);
