import { Component, inject } from "@angular/core";
import { MatButton, MatMiniFabButton } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from "@angular/material/expansion";
import { NgClass, NgStyle } from "@angular/common";
import { MatDialog } from "@angular/material/dialog";
import { Dir } from "@angular/cdk/bidi";
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from "@angular/cdk/drag-drop";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatError, MatInput } from "@angular/material/input";
import { MatSlider, MatSliderThumb } from "@angular/material/slider";
import { FormsModule } from "@angular/forms";
import { MatRadioButton } from "@angular/material/radio";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { Store } from "@ngxs/store";
import { Immutable } from "immer";
import invert from "invert-color";

import { ShareEditDialogComponent, ShareEditDialogComponentData } from "../../dialogs/share-edit-dialog.component";
import { FileSaveDialogComponent } from "../../../components/dialogs/file-save-dialog.component";
import { DistancePipe } from "../../../pipes/distance.pipe";
import { Angulartics2OnModule } from "../../../directives/gtag.directive";
import { NameInUseValidatorDirective } from "../../../directives/name-in-use-validator.directive";
import { SelectedRouteService } from "../../../services/selected-route.service";
import { ResourcesService } from "../../../services/resources.service";
import { SidebarService } from "../../../services/sidebar.service";
import { FileService } from "../../../services/file.service";
import { ToastService } from "../../../services/toast.service";
import { RouteStatistics, RouteStatisticsService } from "../../../services/route-statistics.service";
import { SpatialService } from "../../../services/spatial.service";
import { MapService } from "../../../services/map.service";
import { LogReaderService } from "../../../services/log-reader.service";
import { ShareUrlsService } from "../../../services/share-urls.service";
import { DataContainerService } from "../../../services/data-container.service";
import { RoutesFactory } from "../../../services/routes.factory";
import { ChangeRouteStateAction, ToggleAllRoutesAction, DeleteAllRoutesAction, AddRouteAction, ChangeRoutePropertiesAction, DeleteRouteAction, BulkReplaceRoutesAction } from "../../../reducers/routes.reducer";
import { SetSelectedRouteAction } from "../../../reducers/route-editing.reducer";
import type { ApplicationState, LatLngAltTime, RouteData, ShareUrl } from "../../../models";


@Component({
    selector: "private-routes-sidebar",
    templateUrl: "./private-routes-sidebar.component.html",
    styleUrls: ["./private-routes-sidebar.component.scss"],
    imports: [Dir, MatButton, Angulartics2OnModule, MatTooltip, NgClass, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, NgStyle, MatFormFieldModule, MatInput, FormsModule, MatSlider, MatError, NameInUseValidatorDirective, MatSliderThumb, MatMiniFabButton, MatRadioButton, DistancePipe, MatMenu, MatMenuItem, MatMenuTrigger, CdkDrag, CdkDropList, CdkDragHandle]
})
export class PrivateRoutesSidebarComponent {
    public routes: Immutable<RouteData[]>;
    public colors: string[];

    public readonly resources = inject(ResourcesService);

    private routeStatistics: Record<string, RouteStatistics> = {};

    private readonly store = inject(Store);
    private readonly dialog = inject(MatDialog);
    private readonly routesFactory = inject(RoutesFactory);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly sidebarService = inject(SidebarService);
    private readonly fileService = inject(FileService);
    private readonly toastService = inject(ToastService);
    private readonly routeStatisticsService = inject(RouteStatisticsService);
    private readonly mapService = inject(MapService);
    private readonly logReaderService = inject(LogReaderService);
    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly dataContainerService = inject(DataContainerService);

    constructor() {
        this.colors = this.routesFactory.colors;
        this.store.select((state: ApplicationState) => state.routes.present).subscribe(routes => {
            this.routes = routes;
            this.routeStatistics = {};
            for (const route of routes) {
                const latlngs = this.selectedRouteService.getLatlngs(route);
                this.routeStatistics[route.id] = this.routeStatisticsService.getStatisticsForStandAloneRoute(latlngs);
            }
        });
    }

    public close() {
        this.sidebarService.hide();
    }

    public addRoute(event: Event) {
        event.stopPropagation();
        const routeData = this.routesFactory.createRouteData(this.selectedRouteService.createRouteName(),
            this.selectedRouteService.getLeastUsedColor());

        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        routeData.state = selectedRoute != null && selectedRoute.state !== "Hidden" ? selectedRoute.state : "ReadOnly";
        this.store.dispatch(new AddRouteAction(routeData));
        this.selectedRouteService.setSelectedRoute(routeData.id);
    }

    public toggleRouteVisibility(event: Event, routeData: Immutable<RouteData>) {
        event.stopPropagation();
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null && routeData.id === selectedRoute.id && routeData.state !== "Hidden") {
            this.store.dispatch(new SetSelectedRouteAction(null));
            this.store.dispatch(new ChangeRouteStateAction(routeData.id, "Hidden"));
            return;
        }
        const newRouteState = selectedRoute != null && selectedRoute.state !== "Hidden" ? selectedRoute.state : "ReadOnly";
        this.store.dispatch(new ChangeRouteStateAction(routeData.id, newRouteState));
        this.selectedRouteService.setSelectedRoute(routeData.id);
    }

    public selectRoute(event: Event, routeData: Immutable<RouteData>) {
        event.stopPropagation();
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute?.id === routeData.id) {
            return;
        }
        const newRouteState = selectedRoute != null && selectedRoute.state !== "Hidden" ? selectedRoute.state : "ReadOnly";
        this.store.dispatch(new ChangeRouteStateAction(routeData.id, newRouteState));
        this.selectedRouteService.setSelectedRoute(routeData.id);
    }

    public toggleAllRoutes(event: Event) {
        event.stopPropagation();
        this.store.dispatch(new ToggleAllRoutesAction());
        if (this.isAllRoutesHidden()) {
            this.store.dispatch(new SetSelectedRouteAction(null));
        }
    }

    public isAllRoutesHidden(): boolean {
        return this.store.selectSnapshot((s: ApplicationState) => s.routes).present.find(r => r.state !== "Hidden") == null;
    }

    public isRouteVisible(routeData: Immutable<RouteData>): boolean {
        return routeData.state !== "Hidden";
    }

    public isRouteSelected(routeData: Immutable<RouteData>): boolean {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && selectedRoute.id === routeData.id;
    }

    public isRouteInEditMode(routeData: Immutable<RouteData>): boolean {
        return routeData.state === "Route" || routeData.state === "Poi";
    }

    public isShowActive(routeData: Immutable<RouteData>): boolean {
        return this.isRouteSelected(routeData) && this.store.selectSnapshot((s: ApplicationState) => s.routes).present.length > 1;
    }

    public async openFile(event: Event) {
        const file = this.fileService.getFileFromEvent(event);
        if (!file) {
            return;
        }
        if (file.name.endsWith(".json")) {
            this.toastService.info(this.resources.openingAFilePleaseWait);
            await this.fileService.writeStyle(file.name, await file.text());
            this.toastService.confirm({ type: "Ok", message: this.resources.finishedOpeningTheFile });
            return;
        }
        if (file.name.endsWith(".txt") && file.name.includes("log")) {
            this.toastService.info(this.resources.openingAFilePleaseWait);
            const fileContent = await file.text();
            this.logReaderService.readLogFile(fileContent);
            return;
        }
        try {
            await this.fileService.addRoutesFromFile(file);
        } catch (ex) {
            this.toastService.error(ex as Error, this.resources.unableToLoadFromFile);
        }
    }

    public deleteAllRoutes(event: Event) {
        event.stopPropagation();
        this.toastService.confirm({
            message: this.resources.areYouSureYouWantToDeleteAllRoutes
                .replace("{{count}}", `${this.routes.length}`),
            type: "YesNo",
            confirmAction: () => {
                this.store.dispatch(new DeleteAllRoutesAction());
            },
            declineAction: () => { }
        });
    }

    public getStatistics(routeData: Immutable<RouteData>): RouteStatistics {
        return this.routeStatistics[routeData.id];
    }

    public getCheckIconColor(color: string) {
        return invert(color, true);
    }

    public updateProperty(routeData: Immutable<RouteData>, property: any, value: any) {
        const newRouteData = structuredClone(routeData) as any;
        newRouteData[property] = value;
        this.store.dispatch(new ChangeRoutePropertiesAction(routeData.id, newRouteData));
    }

    public async saveRouteToFile(routeData: Immutable<RouteData>) {
        if (routeData.segments.length === 0 && routeData.markers.length === 0) {
            this.toastService.warning(this.resources.unableToSaveAnEmptyRoute);
            return;
        }
        this.dialog.open<FileSaveDialogComponent, RouteData>(FileSaveDialogComponent, {
            data: structuredClone(routeData) as RouteData
        });
    }

    public moveToRoute(routeData: Immutable<RouteData>) {
        const latLngs = this.getLatlngs(routeData);
        if (latLngs.length === 0) {
            this.toastService.error(new Error("Route data is empty"), this.resources.pleaseAddPointsToRoute);
            return;
        }
        const bounds = SpatialService.getBounds(latLngs);
        if (routeData.state === "Hidden") {
            this.toastService.warning(this.resources.routeIsHidden);
        }
        this.mapService.fitBounds(bounds);
    }

    public share() {
        if (this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo == null) {
            this.toastService.warning(this.resources.loginRequired);
            return;
        }
        const dataContainer = this.dataContainerService.getContainerForRoutes(this.routes.filter(r => r.state !== "Hidden"));
        this.dialog.open<ShareEditDialogComponent, ShareEditDialogComponentData>(ShareEditDialogComponent, {
            width: "480px",
            data: {
                fullShareUrl: structuredClone(this.shareUrlsService.getSelectedShareUrl()) as ShareUrl,
                dataContainer,
                hasHiddenRoutes: this.routes.some(r => r.state === "Hidden"),
            }
        });
    }

    public deleteRoute(event: Event, routeData: Immutable<RouteData>) {
        event.stopPropagation();
        this.toastService.confirm({
            message: this.resources.areYouSure,
            type: "YesNo",
            confirmAction: () => {
                const selectedRoute = this.selectedRouteService.getSelectedRoute();
                if (selectedRoute && selectedRoute.id === routeData.id) {
                    this.store.dispatch(new SetSelectedRouteAction(null));
                }
                this.store.dispatch(new DeleteRouteAction(routeData.id));
            },
            declineAction: () => { }
        });
    }

    public reverseRoute(routeData: Immutable<RouteData>) {
        this.selectedRouteService.reverseRoute(routeData.id);
        this.toastService.info(this.resources.dataUpdatedSuccessfully);
    }

    private getLatlngs(routeData: Immutable<RouteData>): LatLngAltTime[] {
        let latLngs: LatLngAltTime[] = [];
        for (const segment of routeData.segments) {
            latLngs = latLngs.concat(segment.latlngs);
        }
        for (const markers of routeData.markers) {
            latLngs.push(markers.latlng);
        }
        return latLngs;
    }

    public drop(event: CdkDragDrop<string[]>) {
        const currentRoutes = [...this.store.selectSnapshot((s: ApplicationState) => s.routes).present] as RouteData[];
        moveItemInArray(currentRoutes, event.previousIndex, event.currentIndex);
        this.store.dispatch(new BulkReplaceRoutesAction(currentRoutes));
    }
}
