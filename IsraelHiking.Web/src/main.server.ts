import {
    BootstrapContext,
    bootstrapApplication,
    provideClientHydration,
    withNoHttpTransferCache,
    withNoIncrementalHydration
} from "@angular/platform-browser";
import { AppRootComponent } from "./application/components/screens/app-root.component";
import { config } from "./application/app.config.server";

const bootstrap = (context: BootstrapContext) =>
    bootstrapApplication(AppRootComponent, {
        ...config,
        providers: [
            ...config.providers,
            provideClientHydration(withNoIncrementalHydration(), withNoHttpTransferCache())]
    }, context);

export default bootstrap;
