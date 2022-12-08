import { Action, AbstractReducer, ActionPayload, AnyAction } from "@angular-redux2/store";

import type { UICompoentsState } from "../models/models";

export type UIComponentType = "search" | "drawing" | "statistics";

export interface SetUIComponentVisibilityPayload {
    isVisible: boolean;
    component: UIComponentType;
}

export class UIComponentsReducer extends AbstractReducer {
    static actions: {
        setVisibility: ActionPayload<SetUIComponentVisibilityPayload>;
    };

    @Action
    public setVisibility(lastState: UICompoentsState, action: AnyAction<SetUIComponentVisibilityPayload>): UICompoentsState {
        switch (action.payload.component) {
            case "drawing":
                lastState.drawingVisible = action.payload.isVisible;
                break;
            case "search":
                lastState.searchVisible = action.payload.isVisible;
                break;
            case "statistics":
                lastState.statisticsVisible = action.payload.isVisible;
                break;
        }
        return lastState;
    }
}
