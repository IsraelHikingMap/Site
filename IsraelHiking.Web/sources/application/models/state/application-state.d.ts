import { StateWithHistory } from "redux-undo";

import {
    RouteData,
    Configuration,
    Location,
    RouteEditingState,
    TracesState,
    LayersState,
    UserState,
    PointsOfInterestState,
    InMemoryState
} from "../models";

export interface ApplicationState {
    configuration: Configuration;
    location: Location;
    routes: StateWithHistory<RouteData[]>;
    routeEditingState: RouteEditingState;
    tracesState: TracesState;
    layersState: LayersState;
    userState: UserState;
    poiState: PointsOfInterestState;
    inMemoryState: InMemoryState;
}