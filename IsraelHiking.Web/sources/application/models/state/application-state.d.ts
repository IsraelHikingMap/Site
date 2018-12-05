import { StateWithHistory } from "redux-undo";

import {
    RouteData,
    Configuration,
    Location,
    RouteEditingState,
    TracesState,
    LayersState,
    UserState
} from "../models";

export interface ApplicationState {
    configuration: Configuration;
    location: Location;
    routes: StateWithHistory<RouteData[]>;
    routeEditingState: RouteEditingState;
    tracesState: TracesState;
    layersState: LayersState;
    userState: UserState;
}