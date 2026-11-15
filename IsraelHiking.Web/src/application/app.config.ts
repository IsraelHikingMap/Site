import { provideAppInitializer, ErrorHandler, importProvidersFrom, inject, ApplicationConfig } from "@angular/core";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { Title, BrowserModule } from "@angular/platform-browser";
import { ActivatedRouteSnapshot, provideRouter, ViewTransitionInfo, withInMemoryScrolling, withViewTransitions } from "@angular/router";
import { provideStore, withNgxsNoopExecutionStrategy, withNgxsPlugin } from "@ngxs/store";
import { progressInterceptor } from "ngx-progressbar/http";
import { provideLottieOptions } from "ngx-lottie";
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
import { cloneActionPlugin } from "./reducers/clone-action.plugin";
import { routes } from "./app.routes";

/**
 * The map keeps its position in the url, so moving it navigates without changing screens. Only a navigation
 * that shows a different screen is animated - otherwise every pan of the map would fade the whole page.
 */
function skipTransitionWithinScreen({ transition, from, to }: ViewTransitionInfo) {
    if (getScreen(from) === getScreen(to)) {
        transition.skipTransition();
    }
}

function getScreen(snapshot: ActivatedRouteSnapshot) {
    let leaf = snapshot;
    while (leaf.firstChild) {
        leaf = leaf.firstChild;
    }
    return leaf.component;
}

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
        ], withNgxsNoopExecutionStrategy(), withNgxsPlugin(cloneActionPlugin)),
        Title,
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        provideHttpClient(
            withInterceptors([osmTokenInterceptor, clientDetailsInterceptor, progressInterceptor])
        ),
        provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: "enabled" }), withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated: skipTransitionWithinScreen })),
        provideLottieOptions({ player: () => import("lottie-web/build/player/lottie_light") })
    ]
}