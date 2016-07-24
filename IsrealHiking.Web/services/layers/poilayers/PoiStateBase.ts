namespace IsraelHiking.Services.Layers.PoiLayers {
    export class EditMode {
        public static POI = "POI";
        public static ROUTE = "Route";
        public static NONE = "None";
    }

    export abstract class PoiStateBase {
        protected context: PoiLayer;

        constructor(context: PoiLayer) {
            this.context = context;
        }

        public abstract initialize(): void;
        public abstract clear(): void;
        public abstract getEditMode(): string;

        public setReadOnlyState(): void {
            this.context.clearCurrentState();
            this.context.setState(new PoiStateReadOnly(this.context));
        }

        public setEditState(): void {
            this.context.clearCurrentState();
            this.context.setState(new PoiStateEdit(this.context));
        }
    }
}