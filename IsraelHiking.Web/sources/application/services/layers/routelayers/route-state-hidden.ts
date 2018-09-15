import { RouteStateName } from "./iroute-state";
import { RouteStateBase } from "./route-state-base";
import { IRouteLayer } from "./iroute.layer";

export class RouteStateHidden extends RouteStateBase {
    constructor(context: IRouteLayer) {
        super(context);
    }

    public getStateName(): RouteStateName {
        return "Hidden";
    }
}
