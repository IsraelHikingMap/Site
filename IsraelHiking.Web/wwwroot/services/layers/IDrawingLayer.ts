namespace IsraelHiking.Services.Layers {
    export type EditMode = "POI" | "Route" | "None";

    export namespace EditModeString {
        export const poi: EditMode = "POI";
        export const none: EditMode = "None";
        export const route: EditMode = "Route";
    }

    export interface IDrawingLayer extends L.Layer {
        clear(): void;
        getEditMode(): EditMode;
        undo(): void;
        isUndoDisbaled(): boolean;
        readOnly(): void;
    }
}