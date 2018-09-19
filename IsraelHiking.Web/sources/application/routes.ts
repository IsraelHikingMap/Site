import { RouteStrings } from "./services/hash.service";
import { ApplicationStateComponent } from "./components/application-state.component";

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
        component: ApplicationStateComponent
    },
    {
        path: `${RouteStrings.DOWNLOAD}`,
        component: ApplicationStateComponent
    },
    {
        path: `${RouteStrings.SEARCH}/:${RouteStrings.TERM}`,
        component: ApplicationStateComponent
    },
    {
        path: "",
        component: ApplicationStateComponent,
        pathMatch: "full"
    }
];