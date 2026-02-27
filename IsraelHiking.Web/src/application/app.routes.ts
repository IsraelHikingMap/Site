import { Route } from "@angular/router";
import { LandingComponent } from "./components/screens/landing.component";
import { MainMapComponent } from "./components/map/main-map.component";
import { PrivacyPolicyComponent } from "./components/screens/privacy-policy.component";
import { FaqComponent } from "./components/screens/faq.component";
import { AttributionComponent } from "./components/screens/attribution.component";
import { SharesComponent } from "./components/screens/shares.component";
import { OfflineManagementComponent } from "./components/screens/offline-management.component";
import { environment } from "environments/environment";

export const routes: Route[] = [
    { path: "", redirectTo: environment.isCapacitor ? "/map" : "/about", pathMatch: "full" },
    { path: "about", component: LandingComponent },
    { path: "privacy-policy", component: PrivacyPolicyComponent },
    { path: "faq", component: FaqComponent },
    { path: "attribution", component: AttributionComponent },
    { path: "shares", component: SharesComponent },
    { path: "offline-management", component: OfflineManagementComponent },
    { path: "**", component: MainMapComponent }
];