import { RouteStateName } from "../../../models/models";

export interface IRouteState {
    reRoute: () => void;
    initialize(): void;
    clear(): void;
    getStateName(): RouteStateName;
}
