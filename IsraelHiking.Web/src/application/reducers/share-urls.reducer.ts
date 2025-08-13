import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { ShareUrl, ShareUrlsState } from "../models";

export class AddShareUrlAction {
    public static type = this.prototype.constructor.name;
    constructor(public shareUrl: ShareUrl) {}
}

export class RemoveShareUrlAction {
    public static type = this.prototype.constructor.name;
    constructor(public shareUrlId: string) {}
}

export class UpdateShareUrlAction {
    public static type = this.prototype.constructor.name;
    constructor(public shareUrl: ShareUrl) {}
}
@State<ShareUrlsState>({
    name: "shareUrlsState",
    defaults: initialState.shareUrlsState
})
@Injectable()
export class ShareUrlsReducer {

    @Action(AddShareUrlAction)
    public addShareUrl(ctx: StateContext<ShareUrlsState>, action: AddShareUrlAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.shareUrls.push(action.shareUrl);
            return lastState;
        }));
    }

    @Action(RemoveShareUrlAction)
    public removeShareUrl(ctx: StateContext<ShareUrlsState>, action: RemoveShareUrlAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.shareUrls = lastState.shareUrls.filter(s => s.id !== action.shareUrlId);
            return lastState;
        }));
    }

    @Action(UpdateShareUrlAction)
    public updateShareUrl(ctx: StateContext<ShareUrlsState>, action: UpdateShareUrlAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const shareUrlIndex = lastState.shareUrls.findIndex(s => s.id === action.shareUrl.id);
            lastState.shareUrls.splice(shareUrlIndex, 1, action.shareUrl);
            return lastState;
        }));
    }
}
