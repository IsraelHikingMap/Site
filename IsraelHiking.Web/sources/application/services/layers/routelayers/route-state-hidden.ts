import { RouteStateName } from "./iroute-state";
import { RouteStateBase } from "./route-state-base";
import { IRouteLayer } from "./iroute.layer";

export class RouteStateHidden extends RouteStateBase {
    constructor(context: IRouteLayer) {
        super(context);
    }

    public initialize() {
        // no need to do anything.
    }

    public clear() {
        // no need to do anything
    }

    public getStateName(): RouteStateName {
        return "Hidden";
    }
}
