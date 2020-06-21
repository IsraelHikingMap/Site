import { Component, ViewEncapsulation } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { MatDialog } from "@angular/material";
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { select, NgRedux } from "@angular-redux/store";
import { Observable } from "rxjs";

import { SidebarService } from "../../services/sidebar.service";
import { LayersService } from "../../services/layers/layers.service";
import { ResourcesService } from "../../services/resources.service";
import { BaseMapComponent } from "../base-map.component";
import { BaseLayerAddDialogComponent } from "../dialogs/layers/base-layer-add-dialog.component";
import { BaseLayerEditDialogComponent } from "../dialogs/layers/base-layer-edit-dialog.component";
import { OverlayAddDialogComponent } from "../dialogs/layers/overlay-add-dialog.component";
import { OverlayEditDialogComponent } from "../dialogs/layers/overlay-edit-dialog-component";
import { RouteAddDialogComponent } from "../dialogs/routes/route-add-dialog.component";
import { RouteEditDialogComponent } from "../dialogs/routes/route-edit-dialog.component";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { SetSelectedRouteAction } from "../../reducres/route-editing-state.reducer";
import { ChangeRoutePropertiesAction, BulkReplaceRoutesAction } from "../../reducres/routes.reducer";
import { ExpandGroupAction, CollapseGroupAction, ToggleOfflineAction } from "../../reducres/layers.reducer";
import { SetOfflineLastModifiedAction } from "../../reducres/offline.reducer";
import { RunningContextService } from "../../services/running-context.service";
import { ToastService } from "../../services/toast.service";
import { PurchaseService } from "../../services/purchase.service";
import { FileService } from "../../services/file.service";
import { DatabaseService } from "../../services/database.service";
import { LoggingService } from "../../services/logging.service";
import { Urls } from "../../urls";
import { ApplicationState, RouteData, EditableLayer, Overlay, CategoriesGroup } from "../../models/models";

@Component({
    selector: "layers-sidebar",
    templateUrl: "./layers-sidebar.component.html",
    styleUrls: ["./layers-sidebar.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class LayersSidebarComponent extends BaseMapComponent {

    @select((state: ApplicationState) => state.layersState.baseLayers)
    public baseLayers: Observable<EditableLayer[]>;

    @select((state: ApplicationState) => state.layersState.overlays)
    public overlays: Observable<Overlay[]>;

    @select((state: ApplicationState) => state.layersState.categoriesGroups)
    public categoriesGroups: Observable<CategoriesGroup>;

    @select((state: ApplicationState) => state.routes.present)
    public routes: Observable<RouteData[]>;

    @select((state: ApplicationState) => state.offlineState.lastModifiedDate)
    public lastModified: Observable<Date>;

    constructor(resources: ResourcesService,
                private readonly dialog: MatDialog,
                private readonly httpClient: HttpClient,
                private readonly purchaseService: PurchaseService,
                private readonly layersService: LayersService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly sidebarService: SidebarService,
                private readonly runningContextService: RunningContextService,
                private readonly toastService: ToastService,
                private readonly fileService: FileService,
                private readonly databaseService: DatabaseService,
                private readonly loggingService: LoggingService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    public closeSidebar() {
        this.sidebarService.hide();
    }

    public addBaseLayer(event: Event) {
        event.stopPropagation();
        this.dialog.open(BaseLayerAddDialogComponent);
    }

    public editBaseLayer(e: Event, layer: EditableLayer) {
        e.stopPropagation();
        let dialogRef = this.dialog.open(BaseLayerEditDialogComponent);
        dialogRef.componentInstance.setBaseLayer(layer);
    }

    public expand(group: string) {
        this.ngRedux.dispatch(new ExpandGroupAction({ name: group }));
    }

    public collapse(group: string) {
        this.ngRedux.dispatch(new CollapseGroupAction({ name: group }));
    }

    public getExpandState(group: string): boolean {
        return this.ngRedux.getState().layersState.expanded.find(l => l === group) != null;
    }

    public addOverlay(event: Event) {
        event.stopPropagation();
        this.dialog.open(OverlayAddDialogComponent);
    }

    public editOverlay(e: Event, layer: Overlay) {
        e.stopPropagation();
        let dialogRef = this.dialog.open(OverlayEditDialogComponent);
        dialogRef.componentInstance.setOverlay(layer);
    }

    public addRoute(event: Event) {
        event.stopPropagation();
        this.dialog.open(RouteAddDialogComponent);
    }

    public editRoute(routeData: RouteData, event: Event) {
        event.stopPropagation();
        this.dialog.open(RouteEditDialogComponent, {
            data: {
                ...routeData
            }
        });
    }

    public isBaseLayerSelected(baseLayer: EditableLayer): boolean {
        return this.layersService.isBaseLayerSelected(baseLayer);
    }

    public selectBaseLayer(baseLayer: EditableLayer) {
        this.layersService.selectBaseLayer(baseLayer.key);
    }

    public toggleVisibility(overlay: Overlay) {
        this.layersService.toggleOverlay(overlay);
    }

    public showOfflineButton(layer: EditableLayer) {
        let offlineState = this.ngRedux.getState().offlineState;
        return layer.isOfflineAvailable &&
            this.runningContextService.isCordova &&
            (offlineState.lastModifiedDate != null ||
            offlineState.isOfflineAvailable);
    }

    public isOfflineDownloadAvailable() {
        return this.runningContextService.isCordova &&
            this.ngRedux.getState().offlineState.isOfflineAvailable;
    }

    public isPurchaseAvailable() {
        return this.runningContextService.isCordova &&
            !this.ngRedux.getState().offlineState.isOfflineAvailable;
    }

    public orderOfflineMaps() {
        let userInfo = this.ngRedux.getState().userState.userInfo;
        if (userInfo == null || !userInfo.id) {
            this.toastService.warning(this.resources.loginRequired);
            return;
        }
        this.purchaseService.order();
    }

    public async downloadOfflineMaps() {
        let userInfo = this.ngRedux.getState().userState.userInfo;
        if (userInfo == null || !userInfo.id) {
            this.toastService.warning(this.resources.loginRequired);
            return;
        }

        let fileNames = await this.getFilesToDownloadDictionary();
        if (Object.keys(fileNames).length === 0) {
            this.loggingService.info("All offline files are up-to-date");
            this.toastService.success(this.resources.allFilesAreUpToDate + " " + this.resources.useTheCloudIconToGoOffline);
            return;
        }
        this.toastService.progress({
            action: (progress) => this.downloadOfflineFilesProgressAction(progress, fileNames),
            showContinueButton: true,
            continueText: this.resources.largeFilesUseWifi
        });
    }

    private async downloadOfflineFilesProgressAction(reportProgress: (progressValue: number) => void, fileNames: {}): Promise<void> {
        this.sidebarService.hide();
        let setBackToOffline = false;
        if (this.layersService.getSelectedBaseLayer().isOfflineOn) {
            this.ngRedux.dispatch(new ToggleOfflineAction({ key: this.layersService.getSelectedBaseLayer().key, isOverlay: false }));
            setBackToOffline = true;
        }
        try {
            let newestFileDate = new Date(0);
            for (let fileNameIndex = 0; fileNameIndex < length; fileNameIndex++) {
                let fileName = Object.keys(fileNames)[fileNameIndex];
                let fileDate = new Date(fileNames[fileName]);
                newestFileDate = fileDate > newestFileDate ? fileDate : newestFileDate;
                let fileContent = await this.fileService.getFileContentWithProgress(`${Urls.offlineFiles}/${fileName}`,
                    (value) => reportProgress((50.0 / length) * value +
                        fileNameIndex * 100.0 / length));
                if (fileName.endsWith(".mbtiles")) {
                    await this.databaseService.closeDatabase(fileName.replace(".mbtiles", ""));
                    await this.fileService.saveToDatabasesFolder(fileContent as Blob, fileName);
                } else {
                    await this.fileService.openIHMfile(fileContent as Blob,
                        async (content: string) => {
                            await this.databaseService.storePois(JSON.parse(content).features);
                        },
                        async (content, percentage) => {
                            await this.databaseService.storeImages(JSON.parse(content));
                            reportProgress(this.getFileInstallationProgress(length, fileNameIndex, percentage));
                        }
                    );
                }
                reportProgress(this.getFileInstallationProgress(length, fileNameIndex, 100));
            }
            this.loggingService.info("Finished downloading offline files, update date to: " + newestFileDate.toUTCString());
            this.ngRedux.dispatch(new SetOfflineLastModifiedAction({ lastModifiedDate: newestFileDate }));
            this.toastService.success(this.resources.downloadFinishedSuccessfully + " " + this.resources.useTheCloudIconToGoOffline);
            this.sidebarService.show("layers");
        } finally {
            if (setBackToOffline) {
                this.ngRedux.dispatch(new ToggleOfflineAction({ key: this.layersService.getSelectedBaseLayer().key, isOverlay: false }));
            }
        }
    }

    private getFileInstallationProgress(numberOfFile: number, fileNameIndex: number, percentage: number) {
        return (0.5 / numberOfFile) * (percentage) +
            (fileNameIndex * 2 + 1) * 50.0 / numberOfFile;
    }

    private async getFilesToDownloadDictionary(): Promise<{}> {
        let lastModified = this.ngRedux.getState().offlineState.lastModifiedDate;
        return await this.httpClient.get(Urls.offlineFiles, {
            params: {
                lastModified: lastModified ? lastModified.toUTCString() : null,
                mbTiles: "true"
            }
        }).toPromise() as {};
    }

    public toggleOffline(event: Event, layer: EditableLayer, isOverlay: boolean) {
        event.stopPropagation();
        if (this.ngRedux.getState().offlineState.lastModifiedDate == null && !layer.isOfflineOn) {
            this.toastService.warning(this.resources.noOfflineFilesPleaseDownload);
            return;
        }
        this.layersService.toggleOffline(layer, isOverlay);
    }

    public toggleRoute(routeData: RouteData) {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null && routeData.id === selectedRoute.id && routeData.state !== "Hidden") {
            this.ngRedux.dispatch(new SetSelectedRouteAction({ routeId: null }));
            routeData.state = "Hidden";
            this.ngRedux.dispatch(new ChangeRoutePropertiesAction(
                {
                    routeId: routeData.id,
                    routeData
                }));
            return;
        }
        if (routeData.state === "Hidden") {
            routeData.state = "ReadOnly";
            this.ngRedux.dispatch(new ChangeRoutePropertiesAction(
                {
                    routeId: routeData.id,
                    routeData
                }));
        }
        this.selectedRouteService.setSelectedRoute(routeData.id);
    }

    public isRouteVisible(routeData: RouteData) {
        return routeData.state !== "Hidden";
    }

    public isRouteSelected(routeData: RouteData) {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && selectedRoute.id === routeData.id;
    }

    public dropRoute(event: CdkDragDrop<RouteData[]>) {
        let currentRoutes = [...this.ngRedux.getState().routes.present];
        moveItemInArray(currentRoutes, event.previousIndex, event.currentIndex);
        this.ngRedux.dispatch(new BulkReplaceRoutesAction({ routesData: currentRoutes }));
    }
}
