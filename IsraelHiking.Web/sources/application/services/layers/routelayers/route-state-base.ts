import { IRouteState, RouteStateName } from "./iroute-state";
import { IRouteLayer } from "./iroute.layer";

export abstract class RouteStateBase implements IRouteState {
    protected context: IRouteLayer;

    protected constructor(context: IRouteLayer) {
        this.context = context;
    }

    public abstract initialize(): void;
    public abstract clear(): void;
    public abstract getStateName(): RouteStateName;

    public reRoute = (): void => { }; // does nothing if not overriden
}