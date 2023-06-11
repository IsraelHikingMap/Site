import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { ShareUrl, InMemoryState } from "../models/models";

export class ToggleDistanceAction {
    public static type = this.prototype.constructor.name;
}

export class SetFollowingAction {
    public static type = this.prototype.constructor.name;
    constructor(public following: boolean) {}
}

export class SetPannedAction {
    public static type = this.prototype.constructor.name;
    constructor(public pannedTimestamp: Date) {}
}

export class SetShareUrlAction {
    public static type = this.prototype.constructor.name;
    constructor(public shareUrl: ShareUrl) {}
}

export class SetFileUrlAndBaseLayerAction {
    public static type = this.prototype.constructor.name;
    constructor(public fileUrl: string, public baseLayer: string) {}
}

@State({
    name: "inMemoryState",
    defaults: initialState.inMemoryState
})
@Injectable()
export class InMemoryReducer {

    @Action(ToggleDistanceAction)
    public toggleDistance(ctx: StateContext<InMemoryState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.distance = !lastState.distance;
            return lastState;
        }));
    }

    @Action(SetFollowingAction)
    public setFollowing(ctx: StateContext<InMemoryState>, action: SetFollowingAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.following = action.following;
            return lastState;
        }));
    }

    @Action(SetPannedAction)
    public setPanned(ctx: StateContext<InMemoryState>, action: SetPannedAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.pannedTimestamp = action.pannedTimestamp;
            return lastState;
        }));
    }

    @Action(SetShareUrlAction)
    public setShareUrl(ctx: StateContext<InMemoryState>, action: SetShareUrlAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.shareUrl = action.shareUrl;
            return lastState;
        }));
    }

    @Action(SetFileUrlAndBaseLayerAction)
    public setFileUrlAndBaseLayer(ctx: StateContext<InMemoryState>, action: SetFileUrlAndBaseLayerAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.fileUrl = action.fileUrl;
            lastState.baseLayer = action.baseLayer;
            return lastState;
        }));
    }
}
