import { StateWithHistory } from "redux-undo";

import { RouteData, Configuration, Location, RouteEditingState } from "./models";

export interface ApplicationState {
    configuration: Configuration;
    location: Location;
    routes: StateWithHistory<RouteData[]>;
    routeEditingState: RouteEditingState;
    locallyRecordedRoutes: RouteData[];
}