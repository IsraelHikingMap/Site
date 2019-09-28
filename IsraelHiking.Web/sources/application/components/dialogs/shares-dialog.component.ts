import { Component, OnInit, ViewEncapsulation } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Router } from "@angular/router";
import { SharedStorage } from "ngx-store";
import { take } from "lodash";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { RouteStrings } from "../../services/hash.service";
import { ShareUrl } from "../../models/share-url";
import { ShareUrlsService } from "../../services/share-urls.service";
import { DataContainerService } from "../../services/data-container.service";

@Component({
    selector: "shares-dialog",
    templateUrl: "shares-dialog.component.html",
    styleUrls: ["shares-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class SharesDialogComponent extends BaseMapComponent implements OnInit {

    public filteredShareUrls: ShareUrl[];
    public shareUrlInEditMode: ShareUrl;
    public loadingShareUrls: boolean;
    public searchTerm: FormControl;
    public selectedShareUrl: ShareUrl;

    @SharedStorage()
    private sessionSearchTerm = "";

    private page: number;

    constructor(resources: ResourcesService,
                private readonly router: Router,
                private readonly toastService: ToastService,
                private readonly shareUrlsService: ShareUrlsService,
                private readonly dataContainerService: DataContainerService) {
        super(resources);
        this.loadingShareUrls = false;
        this.shareUrlInEditMode = null;
        this.selectedShareUrl = null;
        this.page = 1;
        this.searchTerm = new FormControl();
        this.searchTerm.valueChanges.subscribe((searchTerm: string) => {
            this.updateFilteredLists(searchTerm);
        });
        this.searchTerm.setValue(this.sessionSearchTerm);
    }

    public async ngOnInit() {
        this.loadingShareUrls = true;
        await this.shareUrlsService.getShareUrls();
        this.updateFilteredLists(this.searchTerm.value);
        this.loadingShareUrls = false;
    }

    private updateFilteredLists(searchTerm: string) {
        searchTerm = searchTerm.trim();
        this.sessionSearchTerm = searchTerm;
        let shares = this.shareUrlsService.shareUrls.filter((s) => this.findInShareUrl(s, searchTerm));
        this.filteredShareUrls = take(shares, this.page * 10);
    }

    private findInShareUrl(shareUrl: ShareUrl, searchTerm: string) {
        if (!searchTerm) {
            return true;
        }
        let lowerSearchTerm = searchTerm.toLowerCase();
        if ((shareUrl.description || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((shareUrl.title || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((shareUrl.id || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        return false;
    }

    public deleteShareUrl(shareUrl: ShareUrl) {
        if (this.shareUrlInEditMode === shareUrl) {
            this.shareUrlInEditMode = null;
        }
        let displayName = this.shareUrlsService.getShareUrlDisplayName(shareUrl);
        let message = `${this.resources.deletionOf} ${displayName}, ${this.resources.areYouSure}`;
        this.toastService.confirm({
            message,
            confirmAction: async () => {
                try {
                    await this.shareUrlsService.deleteShareUrl(shareUrl);
                    this.updateFilteredLists(this.searchTerm.value);
                } catch (ex) {
                    this.toastService.error(this.resources.unableToDeleteShare);
                }

            },
            type: "YesNo"
        });
    }

    public isShareUrlInEditMode(shareUrl: ShareUrl) {
        return this.shareUrlInEditMode === shareUrl && this.filteredShareUrls.indexOf(shareUrl) !== -1;
    }

    public async updateShareUrl(shareUrl: ShareUrl) {
        this.shareUrlInEditMode = null;
        await this.shareUrlsService.updateShareUrl(shareUrl);
        this.toastService.success(this.resources.dataUpdatedSuccessfully);
    }

    public showShareUrl(shareUrl: ShareUrl) {
        this.router.navigate([RouteStrings.ROUTE_SHARE, shareUrl.id]);
    }

    public async addShareUrlToRoutes(shareUrl: ShareUrl) {
        let share = await this.shareUrlsService.getShareUrl(shareUrl.id);
        share.dataContainer.overlays = [];
        share.dataContainer.baseLayer = null;
        this.dataContainerService.setData(share.dataContainer, true);
    }

    public toggleSelectedShareUrl(shareUrl) {
        if (this.selectedShareUrl === shareUrl) {
            this.selectedShareUrl = null;
        } else {
            this.selectedShareUrl = shareUrl;
        }
    }

    public hasSelected() {
        return this.selectedShareUrl != null && this.filteredShareUrls.indexOf(this.selectedShareUrl) !== -1;
    }

    public onScrollDown() {
        this.page++;
        this.updateFilteredLists(this.searchTerm.value);
    }

    public getImageFromShareId(shareUrl, width, height) {
        return this.shareUrlsService.getImageFromShareId(shareUrl, width, height);
    }

    public getShareSocialLinks(shareUrl) {
        return this.shareUrlsService.getShareSocialLinks(shareUrl);
    }
}
