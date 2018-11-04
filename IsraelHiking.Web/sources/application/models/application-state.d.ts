import { StateWithHistory } from "redux-undo";

import { RouteData, Configuration, Location, RouteEditingState, TracesState } from "./models";

export interface ApplicationState {
    configuration: Configuration;
    location: Location;
    routes: StateWithHistory<RouteData[]>;
    routeEditingState: RouteEditingState;
    traces: TracesState;
}