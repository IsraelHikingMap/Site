export type RouteStateName = "Poi" | "Route" | "ReadOnly" | "Hidden";

export interface IRouteState {
    reRoute: () => void;
    initialize(): void;
    clear(): void;
    getStateName(): RouteStateName;
}