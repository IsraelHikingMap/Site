import { Component, AfterViewInit } from "@angular/core";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";
import { SocialSharing } from "@ionic-native/social-sharing/ngx";

import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { DataContainerService } from "../../services/data-container.service";
import { BaseMapComponent } from "../base-map.component";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { AuthorizationService } from "../../services/authorization.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { RunningContextService } from "application/services/running-context.service";
import { DataContainer, ShareUrl } from "../../models/models";

@Component({
    selector: "share-dialog",
    templateUrl: "./share-dialog.component.html"
})
export class ShareDialogComponent extends BaseMapComponent implements AfterViewInit {

    public title: string;
    public description: string;
    public imageUrl: string;
    public shareAddress: string;
    public whatsappShareAddress: SafeUrl;
    public facebookShareAddress: string;
    public nakebCreateHikeAddress: string;
    public isLoading: boolean;
    public lastShareUrl: ShareUrl;
    public canUpdate: boolean;
    public updateCurrentShare: boolean;
    public shareOverlays: boolean;

    constructor(resources: ResourcesService,
                private readonly sanitizer: DomSanitizer,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly dataContainerService: DataContainerService,
                private readonly shareUrlsService: ShareUrlsService,
                private readonly toastService: ToastService,
                private readonly authorizationService: AuthorizationService,
                private readonly socialSharing: SocialSharing,
                private readonly runningContextService: RunningContextService
    ) {
        super(resources);

        this.title = "";
        this.description = "";
        this.imageUrl = "";
        this.isLoading = false;
        this.shareAddress = "";
        this.whatsappShareAddress = null;
        this.facebookShareAddress = "";
        this.nakebCreateHikeAddress = "";
        this.lastShareUrl = null;
        let shareUrl = this.shareUrlsService.getSelectedShareUrl();
        this.updateCurrentShare = false;
        this.shareOverlays = false;
        this.canUpdate = false;
        if (shareUrl != null) {
            this.title = shareUrl.title;
            this.description = shareUrl.description;
            this.canUpdate = this.authorizationService.isLoggedIn() &&
                shareUrl.osmUserId.toString() === this.authorizationService.getUserInfo().id.toString();
        }
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null) {
            if (shareUrl == null || (!this.title && !this.description)) {
                this.title = selectedRoute.name;
                this.description = selectedRoute.description;
            }
        }
    }

    public async ngAfterViewInit(): Promise<void> {
        let dataToPreview = this.getDataFiltered();
        let imageUrl = await this.shareUrlsService.getImagePreview(dataToPreview);
        this.imageUrl = this.sanitizer.bypassSecurityTrustUrl(imageUrl) as string;
    }

    public isApp(): boolean {
        return this.runningContextService.isCordova;
    }

    public share() {
        this.socialSharing.shareWithOptions({
            url: this.shareAddress
        });
    }

    public async uploadShareUrl() {
        this.isLoading = true;
        let shareUrlToSend = this.createShareUrlObject();

        try {
            let shareUrl = this.updateCurrentShare
                ? await this.shareUrlsService.updateShareUrl(shareUrlToSend)
                : await this.shareUrlsService.createShareUrl(shareUrlToSend);

            this.lastShareUrl = shareUrl;
            this.shareUrlsService.setShareUrl(shareUrl);
            this.imageUrl = this.shareUrlsService.getImageFromShareId(shareUrl);
            let links = this.shareUrlsService.getShareSocialLinks(shareUrl);
            this.toastService.success(this.resources.dataUpdatedSuccessfully);
            this.shareAddress = links.ihm;
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
        // clone:
        let filteredData = JSON.parse(JSON.stringify(this.dataContainerService.getData()));
        for (let routeIndex = filteredData.routes.length - 1; routeIndex >= 0; routeIndex--) {
            let route = filteredData.routes[routeIndex];
            if (route.segments.length === 0 && route.markers.length === 0 || route.state === "Hidden") {
                filteredData.routes.splice(routeIndex, 1);
            }
        }
        if (!this.shareOverlays) {
            filteredData.overlays = [];
        }
        return filteredData;
    }

    private createShareUrlObject(): ShareUrl {
        let selectedShare = this.shareUrlsService.getSelectedShareUrl();
        let id = selectedShare ? selectedShare.id : "";
        let shareUrl = {
            id,
            title: this.title,
            description: this.description,
            dataContainer: this.getDataFiltered(),
            osmUserId: this.authorizationService.isLoggedIn() ? this.authorizationService.getUserInfo().id : ""
        } as ShareUrl;
        return shareUrl;
    }
}
