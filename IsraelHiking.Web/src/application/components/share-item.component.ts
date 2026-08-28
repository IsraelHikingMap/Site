
import { Component, inject, input, OnInit, output, signal } from "@angular/core";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { MatTooltip } from "@angular/material/tooltip";
import { DatePipe, NgClass } from "@angular/common";
import { DistancePipe } from "../pipes/distance.pipe";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatButton } from "@angular/material/button";
import { Share } from "@capacitor/share";
import type { Immutable } from "immer";

import { HighlightedTextComponent } from "./highlighted-text.component";
import { AnalyticsDirective } from "../directives/analytics.directive";
import { ShareUrlsService } from "../services/share-urls.service";
import { ResourcesService } from "../services/resources.service";
import { RunningContextService } from "../services/running-context.service";
import type { ShareUrl } from "../models/";

@Component({
    selector: "share-item",
    templateUrl: "./share-item.component.html",
    imports: [DatePipe, DistancePipe, MatTooltip, MatMenu, MatMenuItem, MatMenuTrigger, MatButton, CdkCopyToClipboard, AnalyticsDirective, NgClass, HighlightedTextComponent]
})
export class ShareItemComponent implements OnInit {
    public readonly shareUrl = input<Immutable<ShareUrl>>();
    public readonly showMenu = input<boolean>(false);
    public readonly searchTerm = input<string>("");
    public delete = output<void>();
    public editProperties = output<void>();
    public open = output<void>();
    public addToRoutes = output<void>();
    public moveToRoute = output<void>();

    public readonly copiedToClipboard = signal(false);
    public readonly shareAddress = signal<string>(null);
    public readonly whatsappShareAddress = signal<string>(null);
    public readonly facebookShareAddress = signal<string>(null);

    public readonly resources = inject(ResourcesService);

    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly runningContextService = inject(RunningContextService);

    public ngOnInit(): void {
        const links = this.shareUrlsService.getShareSocialLinks(this.shareUrl());
        this.shareAddress.set(links.app);
        this.whatsappShareAddress.set(links.whatsapp);
        this.facebookShareAddress.set(links.facebook);
    }

    public getImageFromShareId(width: number, height: number) {
        return this.shareUrlsService.getImageUrlFromShareId(this.shareUrl().id, width, height);
    }

    public getIconFromType() {
        return this.shareUrlsService.getIconFromType(this.shareUrl().type);
    }

    public isApp() {
        return this.runningContextService.isCapacitor;
    }

    public share() {
        Share.share({
            url: this.shareAddress()
        });
    }
}