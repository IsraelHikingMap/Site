import type { Route } from "@angular/router";
import { MainMapComponent } from "./components/map/main-map.component";

export const routes: Route[] = [
    { path: "**", component: MainMapComponent }
];