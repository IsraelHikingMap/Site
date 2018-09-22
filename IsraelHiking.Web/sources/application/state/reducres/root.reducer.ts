import { combineReducers, ReducersMapObject } from "redux";

import { IApplicationState } from "../models/application-state";
import { configurationReducer } from "./configuration.reducer";

var rootReducer = combineReducers<IApplicationState>({
    configuration: configurationReducer
} as ReducersMapObject<IApplicationState>);

export { rootReducer };