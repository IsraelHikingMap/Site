import { StateWithHistory } from "redux-undo";

import type {
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
    GpsState,
    OfflineState,
    UICompoentsState
} from "../models";

export type ApplicationState = {
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
    gpsState: GpsState;
    offlineState: OfflineState;
    uiComponentsState: UICompoentsState;
};
