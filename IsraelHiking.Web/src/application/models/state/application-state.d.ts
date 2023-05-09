import type {
    RouteData,
    ConfigurationState,
    LocationState,
    RouteEditingState,
    RecordedRouteState,
    TracesState,
    LayersState,
    ShareUrlsState,
    UserState,
    PointsOfInterestState,
    InMemoryState,
    GpsState,
    OfflineState,
    UICompoentsState,
    StateWithHistory
} from "../models";

export type ApplicationState = {
    configuration: ConfigurationState;
    locationState: LocationState;
    routes: StateWithHistory<RouteData[]>;
    routeEditingState: RouteEditingState;
    recordedRouteState: RecordedRouteState;
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
