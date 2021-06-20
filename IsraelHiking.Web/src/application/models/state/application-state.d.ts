import { StateWithHistory } from "redux-undo";

import {
    RouteData,
    Configuration,
    Location,
    RouteEditingState,
    TracesState,
    LayersState,
    ShareUrlsState,
    UserState,
    PointsOfInterestState,
    InMemoryState,
    OfflineState,
    UICompoentsState
} from "../models";

export interface ApplicationState {
    configuration: Configuration;
    location: Location;
    routes: StateWithHistory<RouteData[]>;
    routeEditingState: RouteEditingState;
    tracesState: TracesState;
    layersState: LayersState;
    shareUrlsState: ShareUrlsState;
    userState: UserState;
    poiState: PointsOfInterestState;
    inMemoryState: InMemoryState;
    offlineState: OfflineState;
    uiComponentsState: UICompoentsState;
}
