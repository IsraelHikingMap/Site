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
    { path: "", redirectTo: environment.isCapacitor ? "/map" : "/about", pathMatch: "full" },
    { path: "about", component: LandingComponent },
    { path: "attribution", component: AttributionComponent },
    { path: "faq", component: FaqComponent },
    { path: "offline-management", component: OfflineManagementComponent },
    { path: "public-routes", component: PublicRoutesComponent },
    { path: "privacy-policy", component: PrivacyPolicyComponent },
    { path: "shares", component: SharesComponent },
    { path: "traces", component: TracesComponent },
    { path: "**", component: MainMapComponent }
];