import { Action, combineReducers, ReducersMapObject } from "redux";

import { ConfigurationReducer } from "./configuration.reducer";
import { LocationReducer } from "./location.reducer";
import { routesReducer } from "./routes.reducer";
import { RouteEditingReducer } from "./route-editing.reducer";
import { TracesReducer } from "./traces.reducer";
import { LayersReducer } from "./layers.reducer";
import { ShareUrlsReducer } from "./share-urls.reducer";
import { UserInfoReducer } from "./user.reducer";
import { PointsOfInterestReducer } from "./poi.reducer";
import { InMemoryReducer } from "./in-memory.reducer";
import { GpsReducer } from "./gps.reducer";
import { OfflineReducer } from "./offline.reducer";
import { UIComponentsReducer } from "./ui-components.reducer";
import { RecordedRouteReducer } from "./recorded-route.reducer";
import { initialState } from "./initial-state";
import type { ApplicationState } from "../models/models";

const appReducer = combineReducers<ApplicationState>({
    configuration: ConfigurationReducer.createReducer(initialState.configuration),
    location: LocationReducer.createReducer(initialState.location),
    routes: routesReducer,
    routeEditingState: RouteEditingReducer.createReducer(initialState.routeEditingState),
    recordedRouteState: RecordedRouteReducer.createReducer(initialState.recordedRouteState),
    tracesState: TracesReducer.createReducer(initialState.tracesState),
    layersState: LayersReducer.createReducer(initialState.layersState),
    shareUrlsState: ShareUrlsReducer.createReducer(initialState.shareUrlsState),
    userState: UserInfoReducer.createReducer(initialState.userState),
    poiState: PointsOfInterestReducer.createReducer(initialState.poiState),
    inMemoryState: InMemoryReducer.createReducer(initialState.inMemoryState),
    gpsState: GpsReducer.createReducer(initialState.gpsState),
    offlineState: OfflineReducer.createReducer(initialState.offlineState),
    uiComponentsState: UIComponentsReducer.createReducer(initialState.uiComponentsState)
} as ReducersMapObject<ApplicationState>);

export const rootReducer = (state: ApplicationState, action: Action) => {
    if (action.type === "RESET") {
        return appReducer(initialState, action);
    }
    return appReducer(state, action);
};
