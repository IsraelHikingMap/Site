import { RouteData } from "../models/models";
import { initialState } from "./initial-state";
import { ReduxAction, createReducerFromClass, BaseAction } from "./reducer-action-decorator";

const ADD_LOCALLY_RECORDED_ROUTE = "ADD_LOCALLY_RECORDED_ROUTE";
const REMOVE_LOCALLY_RECORDED_ROUTE = "REMOVE_LOCALLY_RECORDED_ROUTE";

export interface AddLocallyRecordedRoutePayload {
    routeData: RouteData;
}

export interface RemoveLocallyRecordedRoutePayload {
    routeId: string;
}

export class AddLocallyRecordedRouteAction extends BaseAction<AddLocallyRecordedRoutePayload> {
    constructor(payload: AddLocallyRecordedRoutePayload) {
        super(ADD_LOCALLY_RECORDED_ROUTE, payload);
    }
}

export class RemoveLocallyRecordedRouteAction extends BaseAction<RemoveLocallyRecordedRoutePayload> {
    constructor(payload: RemoveLocallyRecordedRoutePayload) {
        super(REMOVE_LOCALLY_RECORDED_ROUTE, payload);
    }
}

class LocallyRecordedRoutesReducer {
    @ReduxAction(ADD_LOCALLY_RECORDED_ROUTE)
    public add(lastState: RouteData[], action: AddLocallyRecordedRouteAction) {
        return [...lastState, action.payload.routeData];
    }

    @ReduxAction(REMOVE_LOCALLY_RECORDED_ROUTE)
    public remove(lastState: RouteData[], action: RemoveLocallyRecordedRouteAction) {
        let routes = [...lastState];
        let routeToRemove = routes.find(r => r.id === action.payload.routeId);
        routes.splice(routes.indexOf(routeToRemove), 1);
        return routes;
    }
}

export const locallyRecordedRoutesReducer = createReducerFromClass(LocallyRecordedRoutesReducer, initialState.locallyRecordedRoutes);