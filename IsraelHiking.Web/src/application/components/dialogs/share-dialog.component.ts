import { Component, AfterViewInit } from "@angular/core";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";
import { SocialSharing } from "@awesome-cordova-plugins/social-sharing/ngx";

import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { DataContainerService } from "../../services/data-container.service";
import { BaseMapComponent } from "../base-map.component";
import { SelectedRouteService } from "../../services/selected-route.service";
import { AuthorizationService } from "../../services/authorization.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { RunningContextService } from "../../services/running-context.service";
import type { DataContainer, ShareUrl } from "../../models/models";

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
    public showUnhide: boolean;
    public unhideRoutes: boolean;

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
        const shareUrl = this.shareUrlsService.getSelectedShareUrl();
        this.updateCurrentShare = false;
        this.shareOverlays = false;
        this.canUpdate = false;
        this.unhideRoutes = true;
        if (shareUrl != null) {
            this.title = shareUrl.title;
            this.description = shareUrl.description;
            this.canUpdate = this.authorizationService.isLoggedIn() &&
                shareUrl.osmUserId.toString() === this.authorizationService.getUserInfo().id.toString();
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

    public async ngAfterViewInit(): Promise<void> {
        const dataToPreview = this.getDataFiltered();
        const imageUrl = await this.shareUrlsService.getImagePreview(dataToPreview);
        this.imageUrl = this.sanitizer.bypassSecurityTrustUrl(imageUrl) as string;
    }

    public isApp(): boolean {
        return this.runningContextService.isCapacitor;
    }

    public share() {
        this.socialSharing.shareWithOptions({
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

            this.lastShareUrl = shareUrl;
            this.shareUrlsService.setShareUrl(shareUrl);
            this.imageUrl = this.shareUrlsService.getImageFromShareId(shareUrl);
            const links = this.shareUrlsService.getShareSocialLinks(shareUrl);
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
        const filteredData = structuredClone(this.dataContainerService.getData(this.unhideRoutes));
        for (let routeIndex = filteredData.routes.length - 1; routeIndex >= 0; routeIndex--) {
            const route = filteredData.routes[routeIndex];
            if (route.state === "Hidden") {
                route.state = "ReadOnly";
            }
        }
        if (!this.shareOverlays) {
            filteredData.overlays = [];
        }
        return filteredData;
    }

    private createShareUrlObject(): ShareUrl {
        const selectedShare = this.shareUrlsService.getSelectedShareUrl();
        const id = selectedShare ? selectedShare.id : "";
        const shareUrl = {
            id,
            title: this.title,
            description: this.description,
            dataContainer: this.getDataFiltered(),
            osmUserId: this.authorizationService.isLoggedIn() ? this.authorizationService.getUserInfo().id : ""
        } as ShareUrl;
        return shareUrl;
    }
}
