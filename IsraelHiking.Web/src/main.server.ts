import {
  BootstrapContext,
  bootstrapApplication,
  provideClientHydration,
} from "@angular/platform-browser";
import { AppRootComponent } from "./application/components/screens/app-root.component";
import { config } from "./application/app.config.server";

const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(AppRootComponent, {
    ...config,
    providers: [
      ...config.providers,
      provideClientHydration()]
  }, context);

export default bootstrap;
