import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatDialogTitle, MatDialogClose, MatDialogContent, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatButton, MatAnchor } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { NgClass } from "@angular/common";
import { MatFormField, MatLabel, MatHint } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatTooltip } from "@angular/material/tooltip";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { MatRadioButton, MatRadioGroup } from "@angular/material/radio";
import { GeoJSONSourceComponent, LayerComponent, MapComponent } from "@maplibre/ngx-maplibre-gl";
import { Share } from "@capacitor/share";
import { LngLatLike, Map, StyleSpecification } from "maplibre-gl";
import { Store } from "@ngxs/store";
import { Immutable } from "immer";

import { LayersComponent } from "../map/layers.component";
import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { DataContainerService } from "../../services/data-container.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { RunningContextService } from "../../services/running-context.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersService } from "../../services/layers.service";
import { MapService } from "../../services/map.service";
import { FileService } from "../../services/file.service";
import type { ApplicationState, EditableLayer, RouteData, ShareUrl } from "../../models";


export type ShareDialogComponentData = {
    mode: "current" | "all"
};

@Component({
    selector: "share-dialog",
    templateUrl: "./share-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, MatCheckbox, MatHint, Angulartics2OnModule, NgClass, MatAnchor, MatTooltip, CdkCopyToClipboard, MapComponent, LayersComponent, LayerComponent, GeoJSONSourceComponent, MatRadioGroup, MatRadioButton]
})
export class ShareDialogComponent {

    public title: string = "";
    public description: string = "";
    public shareAddress: string = "";
    public whatsappShareAddress: string = "";
    public facebookShareAddress: string = "";
    public nakebCreateHikeAddress: string = "";
    public isLoading: boolean = false;
    public canUpdate: boolean = false;
    public updateCurrentShare: boolean = false;
    public hasHiddenRoutes: boolean = false;
    public style: StyleSpecification;
    public center: LngLatLike;
    public baseLayerData: EditableLayer;
    public imageUrl: string;
    public copiedToClipboard: boolean = false;
    public routesGeoJson: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point>;
    public mode: "current" | "all" = "all";
    public allXRoutesText: string = "";

    public readonly resources = inject(ResourcesService);

    private map: Map;
    private availableRoutesCount: number = 0;

    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly dataContainerService = inject(DataContainerService);
    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly toastService = inject(ToastService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly layersService = inject(LayersService);
    private readonly mapService = inject(MapService);
    private readonly fileService = inject(FileService);
    private readonly store = inject(Store);
    private readonly data = inject<ShareDialogComponentData>(MAT_DIALOG_DATA);

    constructor() {
        const shareUrl = this.shareUrlsService.getSelectedShareUrl();
        this.style = this.defaultStyleService.getStyleWithPlaceholders();
        this.baseLayerData = this.layersService.getSelectedBaseLayer();
        if (shareUrl != null) {
            this.title = shareUrl.title;
            this.description = shareUrl.description;
            const userInfo = this.store.selectSnapshot((state: ApplicationState) => state.userState.userInfo);
            this.canUpdate = userInfo &&
                shareUrl.osmUserId.toString() === userInfo.id.toString();
        }
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null) {
            if (shareUrl == null || (!this.title && !this.description)) {
                this.title = selectedRoute.name;
                this.description = selectedRoute.description;
            }
        }
        this.setMode(this.data.mode);
    }

    public async mapLoaded(map: Map) {
        this.map = map;
        this.map.fitBounds(this.mapService.map.getBounds(), { duration: 0 });
        const fullUrl = this.fileService.getFullUrl("content/arrow.png");
        const image = await this.map.loadImage(fullUrl);
        await this.map.addImage("arrow", image.data, { sdf: true });
    }


    public isApp(): boolean {
        return this.runningContextService.isCapacitor;
    }

    public share() {
        Share.share({
            url: this.shareAddress
        });
    }

    /**
     * Allow uploading only when the map is loaded
     * @returns true if the map is loaded
     */
    public canUpload(): boolean {
        return this.map != null;
    }

    public async uploadShareUrl() {
        this.isLoading = true;
        const shareUrlToSend = this.createShareUrlObject();

        try {
            const shareUrl = this.updateCurrentShare
                ? await this.shareUrlsService.updateShareUrl(shareUrlToSend)
                : await this.shareUrlsService.createShareUrl(shareUrlToSend);

            this.shareUrlsService.setShareUrl(shareUrl);
            const links = this.shareUrlsService.getShareSocialLinks(shareUrl);
            this.toastService.success(this.resources.dataUpdatedSuccessfully);
            this.shareAddress = links.app;
            this.imageUrl = this.shareUrlsService.getImageUrlFromShareId(shareUrl.id);
            this.whatsappShareAddress = links.whatsapp;
            this.facebookShareAddress = links.facebook;
            this.nakebCreateHikeAddress = links.nakeb;
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToGenerateUrl);
        } finally {
            this.isLoading = false;
        }
    }

    private createShareUrlObject(): ShareUrl {
        const selectedShare = this.shareUrlsService.getSelectedShareUrl();
        const id = selectedShare ? selectedShare.id : "";
        const osmUserId = this.store.selectSnapshot((state: ApplicationState) => state.userState.userInfo)?.id ?? "";
        const shareUrl = {
            id,
            title: this.title,
            description: this.description,
            dataContainer: this.dataContainerService.getContainerForRoutes(this.getRoutes()),
            osmUserId: osmUserId,
            base64Preview: this.map.getCanvas().toDataURL("image/png"),
        } as ShareUrl;
        return shareUrl;
    }

    private getRoutes(): Immutable<RouteData>[] {
        const availableRoutes = this.getAvailableRoutes();
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        // This is checked to make sure the selected route is not "empty".
        if (this.mode === "current" && availableRoutes.find(r => r.id === selectedRoute?.id)) {
            return [selectedRoute];
        }
        return availableRoutes;
    }

    public setMode(mode: "current" | "all") {
        this.mode = mode;
        this.hasHiddenRoutes = mode === "all" && this.selectedRouteService.hasHiddenRoutes();
        const geojson: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> = { type: "FeatureCollection", features: [] };
        for (const route of this.getRoutes()) {
            geojson.features = geojson.features.concat(this.selectedRouteService.createFeaturesForRoute(route));
        }
        this.routesGeoJson = geojson;
        this.availableRoutesCount = this.getAvailableRoutes().length;
        this.allXRoutesText = this.resources.allXRoutes.replace("{{count}}", this.availableRoutesCount.toString());
    }

    private getAvailableRoutes(): Immutable<RouteData>[] {
        return this.store.selectSnapshot((state: ApplicationState) => state.routes.present)
            .filter(r => r.state !== "Hidden")
            .filter(r => r.segments.length > 0 || r.markers.length > 0);
    }

    public showMutliSelection(): boolean {
        return this.availableRoutesCount > 1;
    }
}
