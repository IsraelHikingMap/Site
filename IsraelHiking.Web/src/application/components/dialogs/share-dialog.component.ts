import { Component, AfterViewInit, inject } from "@angular/core";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";
import { SocialSharing } from "@awesome-cordova-plugins/social-sharing/ngx";

import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { DataContainerService } from "../../services/data-container.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { RunningContextService } from "../../services/running-context.service";
import { Store } from "@ngxs/store";
import type { ApplicationState, DataContainer, ShareUrl } from "../../models/models";

@Component({
    selector: "share-dialog",
    templateUrl: "./share-dialog.component.html"
})
export class ShareDialogComponent implements AfterViewInit {

    public title: string = "";
    public description: string = "";
    public imageUrl: string = "";
    public shareAddress: string = "";
    public whatsappShareAddress: SafeUrl = null;
    public facebookShareAddress: string = "";
    public nakebCreateHikeAddress: string = "";
    public isLoading: boolean = false;
    public lastShareUrl: ShareUrl = null;
    public canUpdate: boolean = false;
    public updateCurrentShare: boolean = false;
    public shareOverlays: boolean = false;
    public showUnhide: boolean;
    public unhideRoutes: boolean = false;

    public readonly resources = inject(ResourcesService);

    private readonly sanitizer = inject(DomSanitizer);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly dataContainerService = inject(DataContainerService);
    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly toastService = inject(ToastService);
    private readonly socialSharing = inject(SocialSharing);
    private readonly runningContextService = inject(RunningContextService);
    private readonly store = inject(Store);

    constructor() {
        const shareUrl = this.shareUrlsService.getSelectedShareUrl();
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
        const osmUserId = this.store.selectSnapshot((state: ApplicationState) => state.userState.userInfo)?.id ?? "";
        const shareUrl = {
            id,
            title: this.title,
            description: this.description,
            dataContainer: this.getDataFiltered(),
            osmUserId: osmUserId
        } as ShareUrl;
        return shareUrl;
    }
}
