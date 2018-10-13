import { RoutingType, RouteEditingState } from "../models/models";
import { ReduxAction, BaseAction, createReducerFromClass } from "./reducer-action-decorator";
import { initialState } from "./initial-state";

const SET_ROUTING_TYPE = "SET_ROUTING_TYPE";
const SET_SELECTED_ROUTE = "SET_SELECTED_ROUTE";

export interface SetRouteEditingStatePayload {
    routingType: RoutingType;
}

export interface SetSelectedRoutePayload {
    routeId: string;
}

export class SetRouteEditingStateAction extends BaseAction<SetRouteEditingStatePayload> {
    constructor(payload: SetRouteEditingStatePayload) {
        super(SET_ROUTING_TYPE, payload);
    }
}

export class SetSelectedRouteAction extends BaseAction<SetSelectedRoutePayload> {
    constructor(payload: SetSelectedRoutePayload) {
        super(SET_SELECTED_ROUTE, payload);
    }
}

class RouteEditingStateReducer {
    @ReduxAction(SET_ROUTING_TYPE)
    public setRoutingType(lastState: RouteEditingState, action: SetRouteEditingStateAction): RouteEditingState {
        return {
            ...lastState,
            routingType: action.payload.routingType
        }
    }

    @ReduxAction(SET_SELECTED_ROUTE)
    public setSelectedRoute(lastState: RouteEditingState, action: SetSelectedRouteAction): RouteEditingState {
        return {
            ...lastState,
            selectedRouteId: action.payload.routeId
        }
    }
}

export const routeEditingReducer = createReducerFromClass(RouteEditingStateReducer, initialState.routeEditingState);