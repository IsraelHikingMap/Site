export type EditMode = "POI" | "Route" | "None";

export interface IRouteState {
    reRoute: () => void;
    initialize(): void;
    clear(): void;
    getEditMode(): EditMode;
}