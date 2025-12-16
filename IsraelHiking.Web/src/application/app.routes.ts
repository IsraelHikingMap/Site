import { Route } from "@angular/router";
import { LandingComponent } from "./components/screens/landing.component";
import { MainMapComponent } from "./components/map/main-map.component";
import { PrivacyPolicyComponent } from "./components/screens/privacy-policy.component";
import { FaqComponent } from "./components/screens/faq.component";
import { AttributionComponent } from "./components/screens/attribution.component";

export const routes: Route[] = [
    { path: "", component: LandingComponent },
    { path: "privacy-policy", component: PrivacyPolicyComponent },
    { path: "faq", component: FaqComponent },
    { path: "attribution", component: AttributionComponent },
    { path: "**", component: MainMapComponent }
];