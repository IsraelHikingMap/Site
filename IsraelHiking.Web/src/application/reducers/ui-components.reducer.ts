import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { UICompoentsState } from "../models";

export type UIComponentType = "drawing" | "statistics";

export class SetUIComponentVisibilityAction {
    public static type = this.prototype.constructor.name;
    constructor(public component: UIComponentType, public isVisible: boolean) {}
}

@State<UICompoentsState>({
    name: "uiComponentsState",
    defaults: initialState.uiComponentsState
})
@Injectable()
export class UIComponentsReducer {

    @Action(SetUIComponentVisibilityAction)
    public setVisibility(ctx: StateContext<UICompoentsState>, action: SetUIComponentVisibilityAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            switch (action.component) {
                case "drawing":
                    lastState.drawingVisible = action.isVisible;
                    break;
                case "statistics":
                    lastState.statisticsVisible = action.isVisible;
                    break;
            }
            return lastState;
        }));
    }
}
