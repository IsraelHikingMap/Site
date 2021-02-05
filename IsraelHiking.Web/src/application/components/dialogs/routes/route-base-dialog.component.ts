import { NgRedux } from "@angular-redux/store";
import invert from "invert-color";

import { ResourcesService } from "../../../services/resources.service";
import { ToastService } from "../../../services/toast.service";
import { RoutesFactory } from "../../../services/layers/routelayers/routes.factory";
import { BaseMapComponent } from "../../base-map.component";
import { ApplicationState, RouteData } from "../../../models/models";
import { SelectedRouteService } from "../../../services/layers/routelayers/selected-route.service";
import { SetOpacityAndWeightAction } from "../../../reducers/route-editing-state.reducer";

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
                protected readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.colors = this.routesFactory.colors;
    }

    public saveRoute() {
        if (this.isRouteNameAlreadyInUse()) {
            this.routeData.name = this.selectedRouteService.createRouteName(this.routeData.name);
            this.toastService.warning(this.resources.routeNameAlreadyInUse);
        }
        this.saveImplementation();
        this.ngRedux.dispatch(new SetOpacityAndWeightAction({
            opacity: this.routeData.opacity,
            weight: this.routeData.weight
        }));
    }

    public getCheckIconColor(color: string) {
        return invert(color, true);
    }

    protected isRouteNameAlreadyInUse(): boolean {
        return this.selectedRouteService.isNameAvailable(this.routeData.name) === false;
    }

    protected abstract saveImplementation();
    public saveRouteToFile() { }
    public moveToRoute = () => { };
    public deleteRoute() { }
    public makeAllPointsEditable = () => { };
    public reverseRoute = () => { };
}
