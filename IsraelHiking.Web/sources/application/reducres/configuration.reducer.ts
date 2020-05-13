import { Action } from "redux";

import { Configuration } from "../models/models";
import { initialState } from "./initial-state";
import { ReduxAction, createReducerFromClass } from "./reducer-action-decorator";

const IS_BATTERY_OPTIMIZATION_TOGGLE = "IS_BATTERY_OPTIMIZATION_TOGGLE";
const IS_AUTOMATIC_RECORDING_UPLOAD_TOGGLE = "IS_AUTOMATIC_RECORDING_UPLOAD_TOGGLE";
// const IS_FIND_MISSING_ROUTES_AFTER_UPLOAD = "IS_FIND_MISSING_ROUTES_AFTER_UPLOAD";
const IS_GOT_LOST_WARNINGS_TOGGLE = "IS_GOT_LOST_WARNINGS_TOGGLE";

export class ConfigurationActions {
    public static readonly toggleIsBatteryOptimizationAction: Action = { type: IS_BATTERY_OPTIMIZATION_TOGGLE };
    public static readonly toggleIsAutomaticRecordingUploadAction: Action = { type: IS_AUTOMATIC_RECORDING_UPLOAD_TOGGLE };
    // public static readonly toggleFindMissingRoutesAfterUploadAction: Action = { type: IS_FIND_MISSING_ROUTES_AFTER_UPLOAD };
    public static readonly toggleIsGotLostWarningsAction: Action = { type: IS_GOT_LOST_WARNINGS_TOGGLE };
}

class ConfigurationReducer {
    @ReduxAction(IS_BATTERY_OPTIMIZATION_TOGGLE)
    public toggleBatteryOptimization(lastState: Configuration, _: Action): Configuration {
        return {
            ...lastState,
            isBatteryOptimization: !lastState.isBatteryOptimization
        };
    }

    @ReduxAction(IS_AUTOMATIC_RECORDING_UPLOAD_TOGGLE)
    public toggleAutomaticRecordingUpload(lastState: Configuration, _: Action): Configuration {
        return {
            ...lastState,
            isAutomaticRecordingUpload: !lastState.isAutomaticRecordingUpload
        };
    }

    // @ReduxAction(IS_FIND_MISSING_ROUTES_AFTER_UPLOAD)
    // public toggleFindMissingRoutesAfterUpload(lastState: Configuration, _: Action): Configuration {
    //     return {
    //         ...lastState,
    //         isFindMissingRoutesAfterUpload: !lastState.isFindMissingRoutesAfterUpload
    //     };
    // }

    @ReduxAction(IS_GOT_LOST_WARNINGS_TOGGLE)
    public toggleGotLostWarnings(lastState: Configuration, _: Action): Configuration {
        return {
            ...lastState,
            isGotLostWarnings: !lastState.isGotLostWarnings
        };
    }
}

export const configurationReducer = createReducerFromClass(ConfigurationReducer, initialState.configuration);
