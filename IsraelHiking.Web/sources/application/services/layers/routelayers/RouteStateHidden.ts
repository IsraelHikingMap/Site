import { EditMode } from "./IRouteState";
import { RouteStateBase } from "./RouteStateBase";
import { IRouteLayer, EditModeString } from "./IRouteLayer";

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

    public getEditMode(): EditMode {
        return EditModeString.none;
    }
}
