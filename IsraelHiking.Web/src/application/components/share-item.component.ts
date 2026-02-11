
import { Component, inject, input } from "@angular/core";
import { Router } from "@angular/router";
import { MatTooltip } from "@angular/material/tooltip";
import { DatePipe } from "@angular/common";
import { DistancePipe } from "../pipes/distance.pipe";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatButton } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import type { Immutable } from "immer";

import { ShareEditDialogComponent, ShareEditDialogComponentData } from "./dialogs/share-edit-dialog.component";
import { ShareUrlsService } from "../services/share-urls.service";
import { ResourcesService } from "../services/resources.service";
import { RouteStrings } from "../services/hash.service";
import type { ShareUrl } from "../models/";

@Component({
    selector: "share-item",
    templateUrl: "./share-item.component.html",
    imports: [DatePipe, DistancePipe, MatTooltip, MatMenu, MatMenuItem, MatMenuTrigger, MatButton]
})
export class ShareItemComponent {
    shareUrl = input<Immutable<ShareUrl>>();
    showMenu = input<boolean>(false);

    public readonly resources = inject(ResourcesService);
    private readonly matDialog = inject(MatDialog);


    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly router = inject(Router);

    public getImageFromShareId(width: number, height: number) {
        return this.shareUrlsService.getImageUrlFromShareId(this.shareUrl().id, width, height);
    }

    public getIconFromType() {
        return this.shareUrlsService.getIconFromType(this.shareUrl().type);
    }

    public delete() {
        this.shareUrlsService.deleteShareUrl(this.shareUrl().id);
    }

    public edit() {
        this.matDialog.open<ShareEditDialogComponent, ShareEditDialogComponentData>(ShareEditDialogComponent, {
            data: {
                shareData: structuredClone(this.shareUrl()) as ShareUrl,
                routes: this.shareUrl().dataContainer.routes,
                hasHiddenRoutes: false
            }
        });
    }

    public editRoute() {
        this.router.navigate([RouteStrings.SHARE, this.shareUrl().id]);
    }
}