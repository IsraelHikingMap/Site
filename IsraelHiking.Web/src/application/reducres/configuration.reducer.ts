import { Action } from "redux";

import { Configuration, Language } from "../models/models";
import { initialState } from "./initial-state";
import { ReduxAction, createReducerFromClass, BaseAction } from "./reducer-action-decorator";

const IS_BATTERY_OPTIMIZATION_TOGGLE = "IS_BATTERY_OPTIMIZATION_TOGGLE";
const IS_AUTOMATIC_RECORDING_UPLOAD_TOGGLE = "IS_AUTOMATIC_RECORDING_UPLOAD_TOGGLE";
// const IS_FIND_MISSING_ROUTES_AFTER_UPLOAD = "IS_FIND_MISSING_ROUTES_AFTER_UPLOAD";
const IS_GOT_LOST_WARNINGS_TOGGLE = "IS_GOT_LOST_WARNINGS_TOGGLE";
const IS_SHOW_BATTERY_CONFIRMATION = "IS_SHOW_BATTERY_CONFIRMATION";
const SET_LANGUAGE = "SET_LANGUAGE";

export class ConfigurationActions {
    public static readonly toggleIsBatteryOptimizationAction: Action = { type: IS_BATTERY_OPTIMIZATION_TOGGLE };
    public static readonly toggleIsAutomaticRecordingUploadAction: Action = { type: IS_AUTOMATIC_RECORDING_UPLOAD_TOGGLE };
    // public static readonly toggleFindMissingRoutesAfterUploadAction: Action = { type: IS_FIND_MISSING_ROUTES_AFTER_UPLOAD };
    public static readonly toggleIsGotLostWarningsAction: Action = { type: IS_GOT_LOST_WARNINGS_TOGGLE };
    public static readonly isShowBatteryConfirmationAction: Action = { type: IS_SHOW_BATTERY_CONFIRMATION };
}

export interface SetLanguagePayload {
    language: Language;
}

export class SetLanguageAction extends BaseAction<SetLanguagePayload> {
    constructor(payload: SetLanguagePayload) {
        super(SET_LANGUAGE, payload);
    }
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

    @ReduxAction(IS_SHOW_BATTERY_CONFIRMATION)
    public stopShowingBatteryConfirmation(lastState: Configuration, _: Action): Configuration {
        return {
            ...lastState,
            isShowBatteryConfirmation: false
        };
    }

    @ReduxAction(SET_LANGUAGE)
    public setLanugage(lastState: Configuration, action: SetLanguageAction): Configuration {
        return {
            ...lastState,
            language: action.payload.language
        };
    }
}

export const configurationReducer = createReducerFromClass(ConfigurationReducer, initialState.configuration);