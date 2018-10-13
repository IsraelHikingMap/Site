import { combineReducers, ReducersMapObject } from "redux";

import { ApplicationState } from "../models/models";
import { configurationReducer } from "./configuration.reducer";
import { locationReducer } from "./location.reducer";
import { routesReducer } from "./routes.reducer";
import { routeEditingReducer } from "./route-editing-state.reducer";

export const rootReducer = combineReducers<ApplicationState>({
    configuration: configurationReducer,
    location: locationReducer,
    routes: routesReducer,
    routeEditingState: routeEditingReducer
} as ReducersMapObject<ApplicationState>);