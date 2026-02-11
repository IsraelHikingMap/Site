import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatDialogTitle, MatDialogClose, MatDialogContent, MAT_DIALOG_DATA, MatDialogActions, MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatAnchor, MatButtonModule } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatFormField, MatLabel, MatHint } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatTooltip } from "@angular/material/tooltip";
import { MatRadioButton, MatRadioGroup } from "@angular/material/radio";
import { MapComponent, ControlComponent } from "@maplibre/ngx-maplibre-gl";
import { LngLatLike, Map, StyleSpecification } from "maplibre-gl";
import { Store } from "@ngxs/store";
import { Immutable } from "immer";

import { LayersComponent } from "../map/layers.component";
import { ShareShowDialogComponent } from "./share-show-dialog.component";
import { RoutesPathComponent } from "../map/routes-path.component";
import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { DataContainerService } from "../../services/data-container.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { RunningContextService } from "../../services/running-context.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { RouteStatisticsService } from "../../services/route-statistics.service";
import { ImageResizeService } from "../../services/image-resize.service";
import { MapService } from "../../services/map.service";
import type { ApplicationState, RouteDataWithoutState, ShareUrl } from "../../models";

export type ShareEditDialogComponentData = {
    shareData: ShareUrl
    routes: Immutable<RouteDataWithoutState[]>
    hasHiddenRoutes: boolean
};

@Component({
    selector: "share-edit-dialog",
    templateUrl: "./share-edit-dialog.component.html",
    styleUrls: ["./share-edit-dialog.component.scss"],
    imports: [Dir, MatDialogTitle, MatDialogClose, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, MatCheckbox, MatHint, Angulartics2OnModule, MatAnchor, MapComponent, LayersComponent, MatRadioGroup, MatRadioButton, MatDialogActions, MatFormField, ControlComponent, MatButtonModule, MatTooltip, RoutesPathComponent]
})
export class ShareEditDialogComponent {
    public shareUrl: ShareUrl;

    public isLoading: boolean = false;
    public canUpdate: boolean = false;
    public updateCurrentShare: boolean = false;
    public hasHiddenRoutes: boolean = false;
    public style: StyleSpecification;
    public center: LngLatLike;
    public copiedToClipboard: boolean = false;
    public routesGeoJson: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> = { type: "FeatureCollection", features: [] };
    public canPublishPublic: boolean = false;

    public readonly resources = inject(ResourcesService);

    private map: Map;

    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly dataContainerService = inject(DataContainerService);
    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly toastService = inject(ToastService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly store = inject(Store);
    private readonly matDialog = inject(MatDialog);
    private readonly matDialogRef = inject(MatDialogRef);
    private readonly routeStatisticsService = inject(RouteStatisticsService);
    private readonly imageResizeService = inject(ImageResizeService);
    private readonly mapService = inject(MapService);
    private readonly data = inject<ShareEditDialogComponentData>(MAT_DIALOG_DATA);

    constructor() {
        this.shareUrl = this.data.shareData;
        const locationState = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
        this.style = this.defaultStyleService.getStyleWithPlaceholders();
        this.style.zoom = locationState.zoom;
        this.style.center = [locationState.longitude, locationState.latitude];
        const userInfo = this.store.selectSnapshot((state: ApplicationState) => state.userState.userInfo);
        this.hasHiddenRoutes = this.data.hasHiddenRoutes;
        if (this.shareUrl != null) {
            this.shareUrl.public = this.shareUrl.public ?? false;
            this.shareUrl.type = this.shareUrl.type || "Unknown";
            this.shareUrl.difficulty = this.shareUrl.difficulty || "Unknown";
            this.shareUrl.base64Preview = this.shareUrlsService.getImageUrlFromShareId(this.shareUrl.id);
            this.canUpdate = userInfo &&
                this.shareUrl.osmUserId.toString() === userInfo.id.toString();
        } else {
            this.shareUrl = {
                id: "",
                osmUserId: userInfo?.id ?? "",
                title: this.data.routes[0]?.name ?? "",
                description: this.data.routes[0]?.description ?? "",
                type: "Unknown",
                difficulty: "Unknown",
                public: false,
                base64Preview: null
            };
        }
        this.updateDataContainerAndStatisticsFromRoutes();
        const geojson: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> = { type: "FeatureCollection", features: [] };
        for (const route of this.data.routes) {
            geojson.features = geojson.features.concat(this.selectedRouteService.createFeaturesForRoute(route));
        }
        this.routesGeoJson = geojson;
        this.shareUrlsService.getUserPermissions().then((permissions) => {
            this.canPublishPublic = permissions.canPublishPublic;
        });
    }

    public async mapLoaded(map: Map) {
        this.map = map;
        this.mapService.addArrowToMap(map);
        if (this.shareUrl.dataContainer) {
            this.map.fitBounds([this.shareUrl.dataContainer.southWest, this.shareUrl.dataContainer.northEast], { duration: 0 });
        }
    }

    public isApp(): boolean {
        return this.runningContextService.isCapacitor;
    }

    /**
     * Allow uploading only when the map is loaded or there's an image already
     * @returns true if the map is loaded
     */
    public canUpload(): boolean {
        return this.map != null || this.shareUrl.base64Preview != null;
    }

    public async uploadShareUrl() {
        this.isLoading = true;
        if (this.shareUrl.base64Preview == null) {
            this.shareUrl.base64Preview = this.map.getCanvas().toDataURL("image/png")
        }
        try {
            const shareUrl = this.updateCurrentShare
                ? await this.shareUrlsService.updateShareUrl(this.shareUrl)
                : await this.shareUrlsService.createShareUrl(this.shareUrl);

            this.shareUrlsService.setShareUrl(shareUrl);
            this.toastService.success(this.resources.dataUpdatedSuccessfully);
            this.matDialogRef.close();
            this.matDialog.open<ShareShowDialogComponent, Immutable<ShareUrl>>(ShareShowDialogComponent, {
                data: shareUrl,
                width: "480px"
            });
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToGenerateUrl);
        } finally {
            this.isLoading = false;
        }
    }

    private updateDataContainerAndStatisticsFromRoutes() {
        const dataContainer = this.dataContainerService.getContainerForRoutes(this.data.routes);
        const latlngs = this.selectedRouteService.getLatlngs(dataContainer.routes[0]);
        const statistics = this.routeStatisticsService.getStatisticsForStandAloneRoute(latlngs);
        for (let routeIndex = 1; routeIndex < dataContainer.routes.length; routeIndex++) {
            const latlngs = this.selectedRouteService.getLatlngs(dataContainer.routes[routeIndex]);
            const statistics = this.routeStatisticsService.getStatisticsForStandAloneRoute(latlngs);
            statistics.gain += statistics.gain;
            statistics.loss += statistics.loss;
            statistics.length += statistics.length;
        }
        this.shareUrl.dataContainer = dataContainer;
        this.shareUrl.gain = statistics.gain;
        this.shareUrl.loss = statistics.loss;
        this.shareUrl.length = statistics.length;
    }

    public async addImage(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file == null) {
            return;
        }
        this.shareUrl.base64Preview = await this.imageResizeService.resizeImage(file, 1600);
    }

    public removeImage() {
        this.shareUrl.base64Preview = null;
    }
}
