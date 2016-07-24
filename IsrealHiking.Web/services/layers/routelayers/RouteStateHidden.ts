namespace IsraelHiking.Services.Layers.RouteLayers {
    export class RouteStateHidden extends RouteStateBase {
        constructor(context: RouteLayer) {
            super(context);
        }

        public initialize() {
            // no need to do anything.
        }

        public clear() {
            // no need to do anything
        }

        public getEditMode() {
            return EditMode.NONE;
        }
    }
}