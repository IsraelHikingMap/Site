import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { OfflineState, TileMetadataPerFile } from "../models";

export class SetOfflineSubscribedAction {
    public static readonly type = this.prototype.constructor.name;
    constructor(public readonly isSubscribed: boolean) { }
}

export class SetOfflineMapsLastModifiedDateAction {
    public static readonly type = this.prototype.constructor.name;
    constructor(public readonly data: TileMetadataPerFile, public readonly tileX: number, public readonly tileY: number) { }
}

export class DeleteOfflineMapsTileAction {
    public static readonly type = this.prototype.constructor.name;
    constructor(public readonly tileX: number, public readonly tileY: number) { }
}

export class AddToPoiQueueAction {
    public static readonly type = this.prototype.constructor.name;
    constructor(public readonly featureId: string) { }
}

export class RemoveFromPoiQueueAction {
    public static readonly type = this.prototype.constructor.name;
    constructor(public readonly featureId: string) { }
}

export class SetLastOfflineDetectedDate {
    public static readonly type = this.prototype.constructor.name;
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

    @Action(SetOfflineMapsLastModifiedDateAction)
    public setOfflineMpasLastModifiedDate(ctx: StateContext<OfflineState>, action: SetOfflineMapsLastModifiedDateAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            if (lastState.downloadedTiles == null) {
                lastState.downloadedTiles = {};
            }
            lastState.downloadedTiles[`${action.tileX}-${action.tileY}`] = action.data;
            return lastState;
        }));
    }

    @Action(DeleteOfflineMapsTileAction)
    public deleteOfflineMapsTile(ctx: StateContext<OfflineState>, action: DeleteOfflineMapsTileAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            if (lastState.downloadedTiles == null) {
                return lastState;
            }
            delete lastState.downloadedTiles[`${action.tileX}-${action.tileY}`];
            if (Object.keys(lastState.downloadedTiles).length === 0) {
                lastState.downloadedTiles = undefined;
            }
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
