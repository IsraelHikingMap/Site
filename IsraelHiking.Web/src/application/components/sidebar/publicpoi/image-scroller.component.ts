import { Component, OnChanges, SimpleChanges, input, inject, output } from "@angular/core";
import { MatAnchor, MatButton } from "@angular/material/button";
import { Dir } from "@angular/cdk/bidi";
import { AnimationOptions, LottieComponent } from "ngx-lottie";

import { ImageCaptureDirective } from "../../../directives/image-capture.directive";
import { Angulartics2OnModule } from "../../../directives/gtag.directive";
import { ResourcesService } from "../../../services/resources.service";
import { FileService } from "../../../services/file.service";
import { ImageGalleryService } from "../../../services/image-gallery.service";
import { ImageResizeService } from "../../../services/image-resize.service";
import { RunningContextService } from "../../../services/running-context.service";
import { ImageAttributionService, ImageAttribution } from "../../../services/image-attribution.service";
import sceneryPlaceholder from "../../../../content/lottie/placeholder-scenery.json";

@Component({
    selector: "image-scroller",
    templateUrl: "./image-scroller.component.html",
    imports: [LottieComponent, MatAnchor, ImageCaptureDirective, Angulartics2OnModule, MatButton, Dir]
})
export class ImageScrollerComponent implements OnChanges {
    lottiePOI: AnimationOptions = {
        animationData: sceneryPlaceholder,
    };

    private currentIndex: number = 0;

    public currentImageAttribution: ImageAttribution = null;

    public images = input<string[]>();

    public canEdit = input<boolean>();

    public currentImageChanged = output<string>();

    public readonly resources = inject(ResourcesService);

    private readonly fileService = inject(FileService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly imageGalleryService = inject(ImageGalleryService);
    private readonly imageResizeService = inject(ImageResizeService);
    private readonly imageAttributionService = inject(ImageAttributionService);

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes.images) {
            this.currentIndex = 0;
            this.updateCurrentImageAttribution();
        }
    }

    public next() {
        this.currentIndex++;
        if (this.currentIndex >= this.images().length) {
            this.currentIndex = this.images().length - 1;
        }
        this.currentImageChanged.emit(this.getCurrentValue());
        this.updateCurrentImageAttribution();
    }

    public previous() {
        this.currentIndex--;
        if (this.currentIndex < 0) {
            this.currentIndex = 0;
        }
        this.currentImageChanged.emit(this.getCurrentValue());
        this.updateCurrentImageAttribution();
    }

    public hasNext(): boolean {
        return this.currentIndex < this.images().length - 1;
    }

    public hasPrevious(): boolean {
        return this.currentIndex > 0;
    }

    public remove(): void {
        this.images().splice(this.currentIndex, 1);
        this.previous();
    }

    public async add(e: any) {
        if (this.canEdit() === false) {
            return;
        }
        const files = this.fileService.getFilesFromEvent(e);
        for (const file of files) {
            const data = await this.imageResizeService.resizeImage(file);
            this.images().push(data);
            this.currentIndex = this.images().length - 1;
            this.currentImageChanged.emit(this.getCurrentValue());
        }
    }

    public getCurrentValue(): string {
        if (this.images().length === 0) {
            return null;
        }
        return this.images()[this.currentIndex];
    }

    public getCurrentImage() {
        const imageUrl = this.getCurrentValue();
        if (imageUrl == null) {
            return null;
        }
        return this.resources.getResizedImageUrl(imageUrl, 800)
    }

    private async updateCurrentImageAttribution(): Promise<void> {
        const imageUrl = this.getCurrentValue();
        if (imageUrl == null) {
            this.currentImageAttribution = null;
            return;
        }
        this.currentImageAttribution = await this.imageAttributionService.getAttributionForImage(imageUrl);
    }

    public showImage() {
        const imagesUrls = [];
        for (const imageUrl of this.images()) {
            const imageUrlToPush = this.resources.getResizedImageUrl(imageUrl, 1600);
            imagesUrls.push(imageUrlToPush);
        }
        this.imageGalleryService.open(imagesUrls, this.currentIndex);
    }

    public getIndexString() {
        return `${this.currentIndex + 1} / ${this.images().length}`;
    }
}
