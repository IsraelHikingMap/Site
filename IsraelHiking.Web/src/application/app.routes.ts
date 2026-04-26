import { Route } from "@angular/router";
import { environment } from "environments/environment";
import { LandingComponent } from "./components/screens/landing.component";
import { MainMapComponent } from "./components/map/main-map.component";
import { PrivacyPolicyComponent } from "./components/screens/privacy-policy.component";
import { FaqComponent } from "./components/screens/faq.component";
import { AttributionComponent } from "./components/screens/attribution.component";
import { SharesComponent } from "./components/screens/shares.component";
import { TracesComponent } from "./components/screens/traces.component";
import { OfflineManagementComponent } from "./components/screens/offline-management.component";
import { PublicRoutesComponent } from "./components/screens/public-routes.component";

export const routes: Route[] = [
    { path: "", redirectTo: environment.isCapacitor ? "/map" : "/about", pathMatch: "full", title: "Mapeak" },
    { path: "about", component: LandingComponent, title: "Mapeak" },
    { path: "attribution", component: AttributionComponent, title: "Mapeak - Attribution" },
    { path: ":lang/faq", component: FaqComponent, title: "Mapeak - FAQ" },
    { path: "offline-management", component: OfflineManagementComponent, title: "Mapeak - Offline Management" },
    { path: "public-routes", component: PublicRoutesComponent, title: "Mapeak - Public Routes" },
    { path: "privacy-policy", component: PrivacyPolicyComponent, title: "Mapeak - Privacy Policy" },
    { path: "shares", component: SharesComponent, title: "Mapeak - Cloud Saves" },
    { path: "traces", component: TracesComponent, title: "Mapeak - Traces" },
    { path: "**", component: MainMapComponent, title: "Mapeak" }
];