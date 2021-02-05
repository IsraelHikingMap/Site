import { ReduxAction, BaseAction, createReducerFromClass } from "./reducer-action-decorator";

import { UICompoentsState } from "../models/models";
import { initialState } from "./initial-state";

const SET_UI_COMPONENT_VISIBILITY = "SET_UI_COMPONENT_VISIBILITY";

export type UIComponentType = "search" | "drawing" | "statistics";

export interface SetUIComponentVisibilityPayload {
    isVisible: boolean;
    component: UIComponentType;
}

export class SetUIComponentVisibilityAction extends BaseAction<SetUIComponentVisibilityPayload> {
    constructor(payload: SetUIComponentVisibilityPayload) {
        super(SET_UI_COMPONENT_VISIBILITY, payload);
    }
}

export class UIComponentsReducer {
    @ReduxAction(SET_UI_COMPONENT_VISIBILITY)
    public setDownload(lastState: UICompoentsState, action: SetUIComponentVisibilityAction): UICompoentsState {
        let newState = { ...lastState };
        switch (action.payload.component) {
            case "drawing":
                newState.drawingVisible = action.payload.isVisible;
                break;
            case "search":
                newState.searchVisible = action.payload.isVisible;
                break;
            case "statistics":
                newState.statisticsVisible = action.payload.isVisible;
                break;
        }
        return newState;
    }
}

export const uiComponentsReducer = createReducerFromClass(UIComponentsReducer, initialState.uiComponentsState);
