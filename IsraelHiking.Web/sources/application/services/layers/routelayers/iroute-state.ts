export type EditMode = "POI" | "Route" | "None";

export interface IRouteState {
    initialize(): void;
    clear(): void;
    getEditMode(): EditMode;
    reRoute: () => void;
}