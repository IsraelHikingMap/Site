import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatDialogTitle, MatDialogClose, MatDialogContent } from "@angular/material/dialog";
import { MatButton, MatAnchor } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { NgClass } from "@angular/common";
import { MatFormField, MatLabel, MatHint } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatTooltip } from "@angular/material/tooltip";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";
import { Share } from "@capacitor/share";
import { Angulartics2OnModule } from "angulartics2";
import { LngLatLike, Map, StyleSpecification } from "maplibre-gl";
import { Store } from "@ngxs/store";

import { LayersComponent } from "../map/layers.component";
import { RoutesComponent } from "../map/routes.component";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { DataContainerService } from "../../services/data-container.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { RunningContextService } from "../../services/running-context.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersService } from "../../services/layers.service";
import { MapService } from "../../services/map.service";
import type { ApplicationState, DataContainer, EditableLayer, ShareUrl } from "../../models";

@Component({
    selector: "share-dialog",
    templateUrl: "./share-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, MatCheckbox, MatHint, Angulartics2OnModule, NgClass, MatAnchor, MatTooltip, CdkCopyToClipboard, MapComponent, LayersComponent, RoutesComponent]
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
    public showUnhide: boolean;
    public unhideRoutes: boolean = false;
    public style: StyleSpecification;
    public center: LngLatLike;
    public baseLayerData: EditableLayer;
    public imageUrl: string;

    public readonly resources = inject(ResourcesService);

    private map: Map;

    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly dataContainerService = inject(DataContainerService);
    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly toastService = inject(ToastService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly layersService = inject(LayersService);
    private readonly mapService = inject(MapService);
    private readonly store = inject(Store);

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
        this.showUnhide = this.dataContainerService.hasHiddenRoutes();
    }

    public mapLoaded(map: Map) {
        this.map = map;
        this.map.fitBounds(this.mapService.map.getBounds(), { duration: 0 });
    }


    public isApp(): boolean {
        return this.runningContextService.isCapacitor;
    }

    public share() {
        Share.share({
            url: this.shareAddress
        });
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

    private getDataFiltered(): DataContainer {
        const filteredData = structuredClone(this.dataContainerService.getData(this.unhideRoutes));
        for (let routeIndex = filteredData.routes.length - 1; routeIndex >= 0; routeIndex--) {
            const route = filteredData.routes[routeIndex];
            if (route.state === "Hidden") {
                route.state = "ReadOnly";
            }
        }
        filteredData.overlays = [];
        return filteredData;
    }

    private createShareUrlObject(): ShareUrl {
        const selectedShare = this.shareUrlsService.getSelectedShareUrl();
        const id = selectedShare ? selectedShare.id : "";
        const osmUserId = this.store.selectSnapshot((state: ApplicationState) => state.userState.userInfo)?.id ?? "";
        const shareUrl = {
            id,
            title: this.title,
            description: this.description,
            dataContainer: this.getDataFiltered(),
            osmUserId: osmUserId,
            base64Preview: this.map.getCanvas().toDataURL("image/png"),
        } as ShareUrl;
        return shareUrl;
    }
}
