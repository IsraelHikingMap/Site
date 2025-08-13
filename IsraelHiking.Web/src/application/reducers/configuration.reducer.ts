import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { ConfigurationState, Language, BatteryOptimizationType } from "../models";


export class SetLanguageAction {
    public static type = this.prototype.constructor.name;
    constructor(public language: Language) {}
}

export class SetBatteryOptimizationTypeAction {
    public static type = this.prototype.constructor.name;
    constructor(public batteryOptimizationType: BatteryOptimizationType) {}
}

export class ToggleAutomaticRecordingUploadAction {
    public static type = this.prototype.constructor.name;
}

export class ToggleGotLostWarningsAction {
    public static type = this.prototype.constructor.name;
}

export class ToggleIsShowSlopeAction {
    public static type = this.prototype.constructor.name;
}

export class ToggleIsShowKmMarkersAction {
    public static type = this.prototype.constructor.name;
}

export class StopShowingBatteryConfirmationAction {
    public static type = this.prototype.constructor.name;
}

export class StopShowingIntroAction {
    public static type = this.prototype.constructor.name;
}

@State<ConfigurationState>({
    name: "configuration",
    defaults: initialState.configuration
})
@Injectable()
export class ConfigurationReducer{

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

    @Action(StopShowingIntroAction)
    public stopShowingIntro(ctx: StateContext<ConfigurationState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isShowIntro = false;
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
}
