import { Component, inject } from "@angular/core";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { MatTooltip } from "@angular/material/tooltip";
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog";
import { MatButton } from "@angular/material/button";
import { Dir } from "@angular/cdk/bidi";
import { Share } from "@capacitor/share";
import type { Immutable } from "immer";

import { ShareItemComponent } from "../share-item.component";
import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { RunningContextService } from "../../services/running-context.service";
import type { ShareUrl } from "../../models";

@Component({
    selector: "app-share-show-dialog",
    templateUrl: "./share-show-dialog.component.html",
    imports: [Angulartics2OnModule, MatDialogActions, MatDialogTitle, MatDialogContent, CdkCopyToClipboard, MatTooltip, MatButton, Dir, MatDialogClose, ShareItemComponent]
})
export class ShareShowDialogComponent {
    public resources = inject(ResourcesService);

    public shareAddress: string;
    public whatsappShareAddress: string;
    public facebookShareAddress: string;
    public copiedToClipboard: boolean;

    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly runningContextService = inject(RunningContextService);
    public shareUrl = inject<Immutable<ShareUrl>>(MAT_DIALOG_DATA);

    constructor() {
        const links = this.shareUrlsService.getShareSocialLinks(this.shareUrl);
        this.shareAddress = links.app;
        this.whatsappShareAddress = links.whatsapp;
        this.facebookShareAddress = links.facebook;
    }

    public share() {
        Share.share({
            url: this.shareAddress
        });
    }

    public isApp() {
        return this.runningContextService.isCapacitor;
    }
}