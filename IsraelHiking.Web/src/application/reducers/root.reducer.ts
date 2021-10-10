import { Action, combineReducers, ReducersMapObject } from "redux";

import { configurationReducer } from "./configuration.reducer";
import { locationReducer } from "./location.reducer";
import { routesReducer } from "./routes.reducer";
import { routeEditingReducer } from "./route-editing-state.reducer";
import { tracesReducer } from "./traces.reducer";
import { layersReducer } from "./layers.reducer";
import { shareUrlsReducer } from "./share-urls.reducer";
import { userReducer } from "./user.reducer";
import { pointsOfInterestReducer } from "./poi.reducer";
import { inMemoryReducer } from "./in-memory.reducer";
import { gpsReducer } from "./gps.reducer";
import { offlineReducer } from "./offline.reducer";
import { uiComponentsReducer } from "./ui-components.reducer";
import { initialState } from "./initial-state";
import type { ApplicationState } from "../models/models";

const appReducer = combineReducers<ApplicationState>({
    configuration: configurationReducer,
    location: locationReducer,
    routes: routesReducer,
    routeEditingState: routeEditingReducer,
    tracesState: tracesReducer,
    layersState: layersReducer,
    shareUrlsState: shareUrlsReducer,
    userState: userReducer,
    poiState: pointsOfInterestReducer,
    inMemoryState: inMemoryReducer,
    gpsState: gpsReducer,
    offlineState: offlineReducer,
    uiComponentsState: uiComponentsReducer
} as ReducersMapObject<ApplicationState>);

export const rootReducer = (state: ApplicationState, action: Action) => {
    if (action.type === "RESET") {
        return appReducer(initialState, action);
    }
    return appReducer(state, action);
};
