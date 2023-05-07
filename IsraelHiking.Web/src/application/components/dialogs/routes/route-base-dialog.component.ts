import invert from "invert-color";
import { Store } from "@ngxs/store";

import { BaseMapComponent } from "../../base-map.component";
import { ResourcesService } from "../../../services/resources.service";
import { ToastService } from "../../../services/toast.service";
import { RoutesFactory } from "../../../services/routes.factory";
import { SelectedRouteService } from "../../../services/selected-route.service";
import { SetOpacityAndWeightAction } from "../../../reducers/route-editing.reducer";
import type { RouteData } from "../../../models/models";

export abstract class RouteBaseDialogComponent extends BaseMapComponent {
    public colors: string[];
    public isNew: boolean;
    public title: string;
    public isReversed: boolean;

    public routeData: RouteData;

    constructor(resources: ResourcesService,
                protected readonly selectedRouteService: SelectedRouteService,
                protected readonly routesFactory: RoutesFactory,
                protected readonly toastService: ToastService,
                protected readonly store: Store) {
        super(resources);
        this.colors = this.routesFactory.colors;
    }

    public saveRoute() {
        if (this.isRouteNameAlreadyInUse()) {
            this.routeData.name = this.selectedRouteService.createRouteName(this.routeData.name);
            this.toastService.warning(this.resources.routeNameAlreadyInUse);
        }
        this.saveImplementation();
        this.store.dispatch(new SetOpacityAndWeightAction(this.routeData.opacity, this.routeData.weight));
    }

    public getCheckIconColor(color: string) {
        return invert(color, true);
    }

    protected isRouteNameAlreadyInUse(): boolean {
        return this.selectedRouteService.isNameAvailable(this.routeData.name) === false;
    }

    protected abstract saveImplementation(): void;
    public saveRouteToFile() { }
    public moveToRoute = () => { };
    public deleteRoute() { }
    public makeAllPointsEditable = () => { };
    public reverseRoute = () => { };
}
