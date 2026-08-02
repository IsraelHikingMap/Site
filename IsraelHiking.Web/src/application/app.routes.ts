import { inject } from "@angular/core";
import { ResolveFn, Route } from "@angular/router";
import { environment } from "../environments/environment";
import { MapService } from "./services/map.service";

/**
 * Maplibre, its workers and the protocols used by the map styles are only loaded for routes that
 * actually show a map, so that content-only screens (landing, faq, etc.) do not download them.
 * The router waits for this resolver before activating the component, so maplibre is always ready
 * before a style starts loading.
 */
const initializeMapResolver: ResolveFn<void> = () => inject(MapService).initialize();

export const routes: Route[] = [
    { path: "", redirectTo: environment.isCapacitor ? "/map" : "/about", pathMatch: "full", title: "Mapeak" },
    {
        path: "about",
        loadComponent: () => import("./components/screens/landing.component").then(m => m.LandingComponent),
        title: "Mapeak"
    },
    {
        path: "attribution",
        loadComponent: () => import("./components/screens/attribution.component").then(m => m.AttributionComponent),
        title: "Mapeak - Attribution"
    },
    {
        path: ":lang/faq",
        loadComponent: () => import("./components/screens/faq.component").then(m => m.FaqComponent),
        title: "Mapeak - FAQ"
    },
    {
        path: "offline-management",
        loadComponent: () => import("./components/screens/offline-management.component").then(m => m.OfflineManagementComponent),
        title: "Mapeak - Offline Management",
        resolve: { map: initializeMapResolver }
    },
    {
        path: "public-routes",
        loadComponent: () => import("./components/screens/public-routes.component").then(m => m.PublicRoutesComponent),
        title: "Mapeak - Public Routes",
        resolve: { map: initializeMapResolver }
    },
    {
        path: "privacy-policy",
        loadComponent: () => import("./components/screens/privacy-policy.component").then(m => m.PrivacyPolicyComponent),
        title: "Mapeak - Privacy Policy"
    },
    {
        path: "shares",
        loadComponent: () => import("./components/screens/shares.component").then(m => m.SharesComponent),
        title: "Mapeak - Cloud Saves",
        resolve: { map: initializeMapResolver }
    },
    {
        path: "traces",
        loadComponent: () => import("./components/screens/traces.component").then(m => m.TracesComponent),
        title: "Mapeak - Traces",
        resolve: { map: initializeMapResolver }
    },
    {
        path: "**",
        loadComponent: () => import("./components/map/main-map.component").then(m => m.MainMapComponent),
        title: "Mapeak",
        resolve: { map: initializeMapResolver }
    }
];
