import { Action } from "redux";

import { Configuration } from "../models/models";
import { initialState } from "./initial-state";
import { ReduxAction, createReducerFromClass } from "./reducer-action-decorator";

const IS_ADVANCED_TOGGLE = "IS_ADVANCED_TOGGLE";

export class ConfigurationActions {
    public static readonly toggleIsAdvanceAction: Action = { type: IS_ADVANCED_TOGGLE };
}

class ConfigurationReducer {
    @ReduxAction(IS_ADVANCED_TOGGLE)
    public toggleAdvance(lastState: Configuration, action: Action): Configuration {
        return {
            ...lastState,
            isAdvanced: !lastState.isAdvanced
        };
    }
}

export const configurationReducer = createReducerFromClass(ConfigurationReducer, initialState.configuration);