import { combineReducers, ReducersMapObject } from "redux";

import { ApplicationState } from "../models/models";
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
import { offlineReducer } from "./offline.reducer";
import { uiComponentsReducer } from "./ui-components.reducer";

export const rootReducer = combineReducers<ApplicationState>({
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
    offlineState: offlineReducer,
    uiComponentsState: uiComponentsReducer
} as ReducersMapObject<ApplicationState>);
