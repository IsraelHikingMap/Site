namespace IsraelHiking.Services.Layers.RouteLayers {
    export class EditMode {
        public static POI = "POI";
        public static ROUTE = "Route";
        public static NONE = "None";
    }

    export abstract class RouteStateBase {
        protected context: RouteLayer;

        constructor(context: RouteLayer) {
            this.context = context;
        }

        public abstract initialize(): void;
        public abstract clear(): void;
        public abstract getEditMode(): string;

        public reRoute = (): void => { } // does nothing if not overriden

        public setHiddenState(): void {
            this.context.clearCurrentState();
            this.context.setState(new RouteStateHidden(this.context));
        }

        public setReadOnlyState(): void {
            this.context.clearCurrentState();
            this.context.setState(new RouteStateReadOnly(this.context));
        }

        public setEditState(): void {
            this.context.clearCurrentState();
            this.context.setState(new RouteStateEdit(this.context));
        }
    }
}