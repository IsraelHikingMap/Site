import { Action, AbstractReducer } from "@angular-redux2/store";

import type { UICompoentsState } from "../models/models";
import type { ReducerActions } from "./initial-state";

export type UIComponentType = "search" | "drawing" | "statistics";

export interface SetUIComponentVisibilityPayload {
    isVisible: boolean;
    component: UIComponentType;
}

export class UIComponentsReducer extends AbstractReducer {
    static actions: ReducerActions<UIComponentsReducer>;

    @Action
    public setVisibility(lastState: UICompoentsState, payload: SetUIComponentVisibilityPayload): UICompoentsState {
        switch (payload.component) {
            case "drawing":
                lastState.drawingVisible = payload.isVisible;
                break;
            case "search":
                lastState.searchVisible = payload.isVisible;
                break;
            case "statistics":
                lastState.statisticsVisible = payload.isVisible;
                break;
        }
        return lastState;
    }
}
