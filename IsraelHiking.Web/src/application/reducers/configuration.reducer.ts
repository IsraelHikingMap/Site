import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { ConfigurationState, Language, BatteryOptimizationType, ThemeSetting } from "../models";


export class SetLanguageAction {
    public static readonly type = "[Configuration] SetLanguageAction";
    constructor(public readonly language: Language) { }
}

export class SetBatteryOptimizationTypeAction {
    public static readonly type = "[Configuration] SetBatteryOptimizationTypeAction";
    constructor(public readonly batteryOptimizationType: BatteryOptimizationType) { }
}

export class ToggleAutomaticRecordingUploadAction {
    public static readonly type = "[Configuration] ToggleAutomaticRecordingUploadAction";
}

export class ToggleGotLostWarningsAction {
    public static readonly type = "[Configuration] ToggleGotLostWarningsAction";
}

export class ToggleIsShowSlopeAction {
    public static readonly type = "[Configuration] ToggleIsShowSlopeAction";
}

export class ToggleIsShowKmMarkersAction {
    public static readonly type = "[Configuration] ToggleIsShowKmMarkersAction";
}

export class StopShowingBatteryConfirmationAction {
    public static readonly type = "[Configuration] StopShowingBatteryConfirmationAction";
}

export class StopShowingOnboardingAction {
    public static readonly type = "[Configuration] StopShowingOnboardingAction";
}

export class SetUnitsAction {
    public static readonly type = "[Configuration] SetUnitsAction";
    constructor(public readonly units: "metric" | "imperial") { }
}

export class SetDateFormatAction {
    public static readonly type = "[Configuration] SetDateFormatAction";
    constructor(public readonly dateFormat: string) { }
}

export class SetThemeAction {
    public static readonly type = "[Configuration] SetThemeAction";
    constructor(public readonly theme: ThemeSetting) { }
}

@State<ConfigurationState>({
    name: "configuration",
    defaults: initialState.configuration
})
@Injectable()
export class ConfigurationReducer {

    @Action(SetBatteryOptimizationTypeAction)
    public setBatteryOptimization(ctx: StateContext<ConfigurationState>, action: SetBatteryOptimizationTypeAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.batteryOptimizationType = action.batteryOptimizationType;
            return lastState;
        }));
    }

    @Action(ToggleAutomaticRecordingUploadAction)
    public toggleAutomaticRecordingUpload(ctx: StateContext<ConfigurationState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isAutomaticRecordingUpload = !lastState.isAutomaticRecordingUpload;
            return lastState;
        }));
    }

    @Action(ToggleGotLostWarningsAction)
    public toggleGotLostWarnings(ctx: StateContext<ConfigurationState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isGotLostWarnings = !lastState.isGotLostWarnings;
            return lastState;
        }));
    }

    @Action(ToggleIsShowSlopeAction)
    public toggleIsShowSlope(ctx: StateContext<ConfigurationState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isShowSlope = !lastState.isShowSlope;
            return lastState;
        }));
    }

    @Action(ToggleIsShowKmMarkersAction)
    public toggleIsShowKmMarkers(ctx: StateContext<ConfigurationState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isShowKmMarker = !lastState.isShowKmMarker;
            return lastState;
        }));
    }

    @Action(StopShowingBatteryConfirmationAction)
    public stopShowingBatteryConfirmation(ctx: StateContext<ConfigurationState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isShowBatteryConfirmation = false;
            return lastState;
        }));
    }

    @Action(StopShowingOnboardingAction)
    public stopShowingOnboarding(ctx: StateContext<ConfigurationState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isShowOnboarding = false;
            return lastState;
        }));
    }

    @Action(SetLanguageAction)
    public setLanguage(ctx: StateContext<ConfigurationState>, action: SetLanguageAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.language = action.language;
            return lastState;
        }));
    }

    @Action(SetUnitsAction)
    public setUnits(ctx: StateContext<ConfigurationState>, action: SetUnitsAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.units = action.units;
            return lastState;
        }));
    }

    @Action(SetDateFormatAction)
    public setDateFormat(ctx: StateContext<ConfigurationState>, action: SetDateFormatAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.dateFormat = action.dateFormat;
            return lastState;
        }));
    }

    @Action(SetThemeAction)
    public setTheme(ctx: StateContext<ConfigurationState>, action: SetThemeAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.theme = action.theme;
            return lastState;
        }));
    }
}
