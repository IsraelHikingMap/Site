import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { OfflineState } from "../models";

export class SetOfflineAvailableAction {
    public static type = this.prototype.constructor.name;
    constructor(public isAvailble: boolean) {}
}

export class SetOfflineMapsLastModifiedDateAction {
    public static type = this.prototype.constructor.name;
    constructor(public lastModifiedDate: Date) {}
}

export class SetShareUrlsLastModifiedDateAction {
    public static type = this.prototype.constructor.name;
    constructor(public lastModifiedDate: Date) {}
}

export class AddToPoiQueueAction {
    public static type = this.prototype.constructor.name;
    constructor(public featureId: string) {}
}

export class RemoveFromPoiQueueAction {
    public static type = this.prototype.constructor.name;
    constructor(public featureId: string) {}
}

@State<OfflineState>({
    name: "offlineState",
    defaults: initialState.offlineState
})
@Injectable()
export class OfflineReducer {

    @Action(SetOfflineAvailableAction)
    public setOfflineAvailable(ctx: StateContext<OfflineState>, action: SetOfflineAvailableAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isOfflineAvailable = action.isAvailble;
            return lastState;
        }));
    }

    @Action(SetOfflineMapsLastModifiedDateAction)
    public setOfflineMpasLastModifiedDate(ctx: StateContext<OfflineState>, action: SetOfflineMapsLastModifiedDateAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.lastModifiedDate = action.lastModifiedDate;
            lastState.isPmtilesDownloaded = true;
            return lastState;
        }));
    }

    @Action(SetShareUrlsLastModifiedDateAction)
    public setShareUrlsLastModifiedDate(ctx: StateContext<OfflineState>, action: SetShareUrlsLastModifiedDateAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.shareUrlsLastModifiedDate = action.lastModifiedDate;
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
}
