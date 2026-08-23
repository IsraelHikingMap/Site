import { provideAppInitializer, ErrorHandler, importProvidersFrom, inject, ApplicationConfig } from "@angular/core";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { Title, BrowserModule } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { provideStore, withNgxsNoopExecutionStrategy } from "@ngxs/store";
import { progressInterceptor } from "ngx-progressbar/http";
import { provideLottieOptions } from "ngx-lottie";
import { provideMarkdown } from "ngx-markdown";
// Services
import { osmTokenInterceptor } from "./services/osm-token.interceptor";
import { clientDetailsInterceptor } from "./services/client-details.interceptor";
import { ApplicationInitializeService } from "./services/application-initialize.service";
import { GlobalErrorHandler } from "./services/global-error.handler";
// Map Interactions
// Reducers
import { ConfigurationReducer } from "./reducers/configuration.reducer";
import { LocationReducer } from "./reducers/location.reducer";
import { RoutesReducer } from "./reducers/routes.reducer";
import { RouteEditingReducer } from "./reducers/route-editing.reducer";
import { RecordedRouteReducer } from "./reducers/recorded-route.reducer";
import { TracesReducer } from "./reducers/traces.reducer";
import { LayersReducer } from "./reducers/layers.reducer";
import { ShareUrlsReducer } from "./reducers/share-urls.reducer";
import { UserInfoReducer } from "./reducers/user.reducer";
import { PointsOfInterestReducer } from "./reducers/poi.reducer";
import { InMemoryReducer } from "./reducers/in-memory.reducer";
import { GpsReducer } from "./reducers/gps.reducer";
import { OfflineReducer } from "./reducers/offline.reducer";
import { PaywallReducer } from "./reducers/paywall.reducer";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
    providers: [
        provideAppInitializer(async () => {
            await inject(ApplicationInitializeService).initialize();
        }),
        importProvidersFrom(BrowserModule),
        provideStore([
            ConfigurationReducer,
            LocationReducer,
            RoutesReducer,
            RouteEditingReducer,
            RecordedRouteReducer,
            TracesReducer,
            LayersReducer,
            ShareUrlsReducer,
            UserInfoReducer,
            PointsOfInterestReducer,
            InMemoryReducer,
            GpsReducer,
            OfflineReducer,
            PaywallReducer
        ], withNgxsNoopExecutionStrategy()),
        Title,
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        provideHttpClient(
            withInterceptors([osmTokenInterceptor, clientDetailsInterceptor, progressInterceptor])
        ),
        provideRouter(routes),
        provideLottieOptions({ player: () => import("lottie-web") }),
        provideMarkdown()
    ]
}