import { RouteStrings } from "./services/hash.service";
import { ApplicationStateComponent } from "./components/application-state.component";
import { PublicPoiSidebarComponent } from "./components/sidebar/publicpoi/public-poi-sidebar.component";

export const routes = [
    {
        path: `${RouteStrings.MAP}/:${RouteStrings.ZOOM}/:${RouteStrings.LAT}/:${RouteStrings.LON}`,
        component: ApplicationStateComponent
    },
    {
        path: `${RouteStrings.SHARE}/:${RouteStrings.ID}`,
        component: ApplicationStateComponent
    },
    {
        path: `${RouteStrings.URL}/:${RouteStrings.ID}`,
        component: ApplicationStateComponent
    },
    {
        path: `${RouteStrings.POI}/:${RouteStrings.SOURCE}/:${RouteStrings.ID}`,
        component: PublicPoiSidebarComponent
    },
    {
        path: "",
        component: ApplicationStateComponent,
        pathMatch: "full"
    }
];
