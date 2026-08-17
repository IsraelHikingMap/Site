import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { OfflineState } from "../models";

export class SetOfflineSubscribedAction {
    public static readonly type = "[Offline] SetOfflineSubscribedAction";
    constructor(public readonly isSubscribed: boolean) { }
}

export class AddToPoiQueueAction {
    public static readonly type = "[Offline] AddToPoiQueueAction";
    constructor(public readonly featureId: string) { }
}

export class RemoveFromPoiQueueAction {
    public static readonly type = "[Offline] RemoveFromPoiQueueAction";
    constructor(public readonly featureId: string) { }
}

export class SetLastOfflineDetectedDate {
    public static readonly type = "[Offline] SetLastOfflineDetectedDate";
    constructor(public readonly lastOfflineDetectedDate: Date | null) { }
}

@State<OfflineState>({
    name: "offlineState",
    defaults: initialState.offlineState
})
@Injectable()
export class OfflineReducer {

    @Action(SetOfflineSubscribedAction)
    public setOfflineSubscribed(ctx: StateContext<OfflineState>, action: SetOfflineSubscribedAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isSubscribed = action.isSubscribed;
            return lastState;
        }));
    }

    @Action(AddToPoiQueueAction)
    public addToPoiQueue(ctx: StateContext<OfflineState>, action: AddToPoiQueueAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.uploadPoiQueue.push(action.featureId);
            return lastState;
        }));
    }

    @Action(RemoveFromPoiQueueAction)
    public removeFromPoiQueue(ctx: StateContext<OfflineState>, action: RemoveFromPoiQueueAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.uploadPoiQueue = lastState.uploadPoiQueue.filter(f => f !== action.featureId);
            return lastState;
        }));
    }

    @Action(SetLastOfflineDetectedDate)
    setLastOfflineDetectedDate(ctx: StateContext<OfflineState>, action: SetLastOfflineDetectedDate) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.lastOfflineDetectedDate = action.lastOfflineDetectedDate;
        }));
    }
}
