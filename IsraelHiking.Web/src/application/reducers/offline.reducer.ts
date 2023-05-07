import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { OfflineState } from "../models/models";

export class SetOfflineAvailableAction {
    public static type = this.prototype.constructor.name;
    constructor(public isAvailble: boolean) {}
};

export class SetOfflineMapsLastModifiedAction {
    public static type = this.prototype.constructor.name;
    constructor(public lastModifiedDate: Date) {}
};

export class SetPoiLastModifiedAction {
    public static type = this.prototype.constructor.name;
    constructor(public lastModifiedDate: Date) {}
};

export class SetShareUrlLastModifiedAction {
    public static type = this.prototype.constructor.name;
    constructor(public lastModifiedDate: Date) {}
};

export class AddToPoiQueueAction {
    public static type = this.prototype.constructor.name;
    constructor(public featureId: string) {}
};

export class RemoveFromPoiQueueAction {
    public static type = this.prototype.constructor.name;
    constructor(public featureId: string) {}
};

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

    @Action(SetOfflineMapsLastModifiedAction)
    public setOfflineMpasLastModified(ctx: StateContext<OfflineState>, action: SetOfflineMapsLastModifiedAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.lastModifiedDate = action.lastModifiedDate;
            return lastState;
        }));
    }

    @Action(SetPoiLastModifiedAction)
    public setPoisLastModified(ctx: StateContext<OfflineState>, action: SetPoiLastModifiedAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.poisLastModifiedDate = action.lastModifiedDate;
            return lastState;
        }));
    }

    @Action(SetShareUrlLastModifiedAction)
    public setShareUrlsLastModified(ctx: StateContext<OfflineState>, action: SetShareUrlLastModifiedAction) {
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
