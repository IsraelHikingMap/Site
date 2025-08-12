import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { OfflineState } from "../models";

export class SetOfflineSubscribedAction {
    public static type = this.prototype.constructor.name;
    constructor(public isSubscribed: boolean) {}
}

export class SetOfflineMapsLastModifiedDateAction {
    public static type = this.prototype.constructor.name;
    constructor(public lastModifiedDate: Date, public tileX: number, public tileY: number) {}
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

    @Action(SetOfflineSubscribedAction)
    public setOfflineSubscribed(ctx: StateContext<OfflineState>, action: SetOfflineSubscribedAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isSubscribed = action.isSubscribed;
            return lastState;
        }));
    }

    @Action(SetOfflineMapsLastModifiedDateAction)
    public setOfflineMpasLastModifiedDate(ctx: StateContext<OfflineState>, action: SetOfflineMapsLastModifiedDateAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            if (lastState.downloadedTiles == null) {
                lastState.downloadedTiles = {};
            }
            lastState.downloadedTiles[`${action.tileX}-${action.tileY}`] = action.lastModifiedDate;
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
