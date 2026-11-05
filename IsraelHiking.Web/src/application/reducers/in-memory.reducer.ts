import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { ShareUrl, InMemoryState, PublicRoutesFilter, Theme, DownloadedArea } from "../models";

export class ToggleDistanceAction {
    public static readonly type = "[In Memory] ToggleDistanceAction";
}

export class SetFollowingAction {
    public static readonly type = "[In Memory] SetFollowingAction";
    constructor(public readonly following: boolean) { }
}

export class SetPannedAction {
    public static readonly type = "[In Memory] SetPannedAction";
    constructor(public readonly pannedTimestamp: Date) { }
}

export class SetShareUrlAction {
    public static readonly type = "[In Memory] SetShareUrlAction";
    constructor(public readonly shareUrl: ShareUrl) { }
}

export class SetFileUrlAndBaseLayerAction {
    public static readonly type = "[In Memory] SetFileUrlAndBaseLayerAction";
    constructor(public readonly fileUrl: string, public readonly baseLayer: string) { }
}

export class SetSearchTermAction {
    public static readonly type = "[In Memory] SetSearchTermAction";
    constructor(public readonly searchTerm: string) { }
}

export class SetUrlAction {
    public static readonly type = "[In Memory] SetUrlAction";
    constructor(public readonly url: string) { }
}

export class SetPublicRoutesFilterAction {
    public static readonly type = "[In Memory] SetPublicRoutesFilterAction";
    constructor(public readonly filters: PublicRoutesFilter) { }
}

export class SetEffectiveThemeAction {
    public static readonly type = "[In Memory] SetEffectiveThemeAction";
    constructor(public readonly theme: Theme) { }
}

export class SetDownloadedAreasAction {
    public static readonly type = "[In Memory] SetDownloadedAreasAction";
    constructor(public readonly downloadedAreas: Record<string, DownloadedArea>) { }
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

    @Action(SetSearchTermAction)
    public setSearchTerm(ctx: StateContext<InMemoryState>, action: SetSearchTermAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.searchTerm = action.searchTerm;
            return lastState;
        }));
    }

    @Action(SetUrlAction)
    public setUrl(ctx: StateContext<InMemoryState>, action: SetUrlAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.currentUrl = action.url;
            return lastState;
        }));
    }

    @Action(SetPublicRoutesFilterAction)
    public setPublicRoutesFilter(ctx: StateContext<InMemoryState>, action: SetPublicRoutesFilterAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.publicRoutesFilter = action.filters;
            return lastState;
        }));
    }

    @Action(SetEffectiveThemeAction)
    public setEffectiveTheme(ctx: StateContext<InMemoryState>, action: SetEffectiveThemeAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.effectiveTheme = action.theme;
            return lastState;
        }));
    }

    @Action(SetDownloadedAreasAction)
    public setDownloadedAreas(ctx: StateContext<InMemoryState>, action: SetDownloadedAreasAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.downloadedAreas = action.downloadedAreas;
            return lastState;
        }));
    }
}
