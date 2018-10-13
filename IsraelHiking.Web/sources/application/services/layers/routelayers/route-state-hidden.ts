import { RouteStateBase } from "./route-state-base";
import { IRouteLayer } from "./iroute.layer";
import { RouteStateName } from "../../../models/models";

export class RouteStateHidden extends RouteStateBase {
    constructor(context: IRouteLayer) {
        super(context);
    }

    public getStateName(): RouteStateName {
        return "Hidden";
    }
}
