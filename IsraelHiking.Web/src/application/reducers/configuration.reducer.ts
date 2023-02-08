import { Action } from "redux";
import { Action as ReduxAction, createReducerFromClass } from "@angular-redux2/store";

import { initialState, BaseAction } from "./initial-state";
import type { ConfigurationState, Language, BatteryOptimizationType } from "../models/models";

const TOGGLE_IS_BATTERY_OPTIMIZATION = "TOGGLE_IS_BATTERY_OPTIMIZATION";
const TOGGLE_IS_AUTOMATIC_RECORDING_UPLOAD = "TOGGLE_IS_AUTOMATIC_RECORDING_UPLOAD";
const TOGGLE_IS_GOT_LOST_WARNINGS = "TOGGLE_IS_GOT_LOST_WARNINGS";
const TOGGLE_IS_SHOW_SLOPE = "TOGGLE_IS_SHOW_SLOPE";
const TOGGLE_IS_SHOW_KM_MARKERS = "TOGGLE_IS_SHOW_KM_MARKERS";
const STOP_SHOW_BATTERY_CONFIRMATION = "STOP_SHOW_BATTERY_CONFIRMATION";
const STOP_SHOW_INTRO = "STOP_SHOW_INTRO";
const SET_LANGUAGE = "SET_LANGUAGE";
const SET_BATTERY_OPTIMIZATION_TYPE = "SET_BATTERY_OPTIMIZATION_TYPE";

export class ConfigurationActions {
    public static readonly toggleIsBatteryOptimizationAction: Action = { type: TOGGLE_IS_BATTERY_OPTIMIZATION };
    public static readonly toggleIsAutomaticRecordingUploadAction: Action = { type: TOGGLE_IS_AUTOMATIC_RECORDING_UPLOAD };
    public static readonly toggleIsGotLostWarningsAction: Action = { type: TOGGLE_IS_GOT_LOST_WARNINGS };
    public static readonly toggleIsShowSlopeAction: Action = { type: TOGGLE_IS_SHOW_SLOPE };
    public static readonly toggleIsShowKmMarkersAction: Action = { type: TOGGLE_IS_SHOW_KM_MARKERS };
    public static readonly stopShowBatteryConfirmationAction: Action = { type: STOP_SHOW_BATTERY_CONFIRMATION };
    public static readonly stopShowIntroAction: Action = { type: STOP_SHOW_INTRO };
}

export type SetLanguagePayload = {
    language: Language;
};

export type SetBatteryOptimizationTypePayload = {
    batteryOptimizationType: BatteryOptimizationType;
};

export class SetLanguageAction extends BaseAction<SetLanguagePayload> {
    constructor(payload: SetLanguagePayload) {
        super(SET_LANGUAGE, payload);
    }
}

export class SetBatteryOptimizationTypeAction extends BaseAction<SetBatteryOptimizationTypePayload> {
    constructor(payload: SetBatteryOptimizationTypePayload) {
        super(SET_BATTERY_OPTIMIZATION_TYPE, payload);
    }
}

class ConfigurationReducer {
    @ReduxAction(SET_BATTERY_OPTIMIZATION_TYPE)
    public toggleBatteryOptimization(lastState: ConfigurationState, action: SetBatteryOptimizationTypeAction): ConfigurationState {
        return {
            ...lastState,
            batteryOptimizationType: action.payload.batteryOptimizationType
        };
    }

    @ReduxAction(TOGGLE_IS_AUTOMATIC_RECORDING_UPLOAD)
    public toggleAutomaticRecordingUpload(lastState: ConfigurationState, _: Action): ConfigurationState {
        return {
            ...lastState,
            isAutomaticRecordingUpload: !lastState.isAutomaticRecordingUpload
        };
    }

    @ReduxAction(TOGGLE_IS_GOT_LOST_WARNINGS)
    public toggleGotLostWarnings(lastState: ConfigurationState, _: Action): ConfigurationState {
        return {
            ...lastState,
            isGotLostWarnings: !lastState.isGotLostWarnings
        };
    }

    @ReduxAction(TOGGLE_IS_SHOW_SLOPE)
    public toggleIsShowSlope(lastState: ConfigurationState, _: Action): ConfigurationState {
        return {
            ...lastState,
            isShowSlope: !lastState.isShowSlope
        };
    }

    @ReduxAction(TOGGLE_IS_SHOW_KM_MARKERS)
    public toggleIsShowKmMarkers(lastState: ConfigurationState, _: Action): ConfigurationState {
        return {
            ...lastState,
            isShowKmMarker: !lastState.isShowKmMarker
        };
    }

    @ReduxAction(STOP_SHOW_BATTERY_CONFIRMATION)
    public stopShowingBatteryConfirmation(lastState: ConfigurationState, _: Action): ConfigurationState {
        return {
            ...lastState,
            isShowBatteryConfirmation: false
        };
    }

    @ReduxAction(STOP_SHOW_INTRO)
    public stopShowingIntro(lastState: ConfigurationState, _: Action): ConfigurationState {
        return {
            ...lastState,
            isShowIntro: false
        };
    }

    @ReduxAction(SET_LANGUAGE)
    public setLanugage(lastState: ConfigurationState, action: SetLanguageAction): ConfigurationState {
        return {
            ...lastState,
            language: action.payload.language
        };
    }
}

export const configurationReducer = createReducerFromClass(ConfigurationReducer, initialState.configuration);
