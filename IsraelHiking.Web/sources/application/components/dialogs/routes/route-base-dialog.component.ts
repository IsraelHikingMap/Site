import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { ResourcesService } from "../../../services/resources.service";
import { ToastService } from "../../../services/toast.service";
import { RoutesFactory } from "../../../services/layers/routelayers/routes.factory";
import { BaseMapComponent } from "../../base-map.component";
import { ApplicationState, RouteData } from "../../../models/models";
import { SelectedRouteService } from "../../../services/layers/routelayers/selected-route.service";

export abstract class RouteBaseDialogComponent extends BaseMapComponent {
    public colors: string[];
    public isNew: boolean;
    public title: string;
    public isReversed: boolean;

    public routeData: RouteData;

    @select((state: ApplicationState) => state.configuration.isAdvanced)
    public isAdvanced: Observable<boolean>;

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
