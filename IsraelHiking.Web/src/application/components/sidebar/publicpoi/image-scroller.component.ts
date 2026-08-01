import { Component, OnChanges, SimpleChanges, input, inject, model, output, signal, computed } from "@angular/core";
import { MatAnchor, MatButton } from "@angular/material/button";
import { Dir } from "@angular/cdk/bidi";
import { AnimationOptions, LottieComponent } from "ngx-lottie";

import { ImageAttributionComponent } from "../../image-attribution.component";
import { ImageCaptureDirective } from "../../../directives/image-capture.directive";
import { AnalyticsDirective } from "../../../directives/analytics.directive";
import { ResourcesService } from "../../../services/resources.service";
import { FileService, HTMLElementInputChangeEvent } from "../../../services/file.service";
import { ImageGalleryService } from "../../../services/image-gallery.service";
import { ImageResizeService } from "../../../services/image-resize.service";

@Component({
    selector: "image-scroller",
    templateUrl: "./image-scroller.component.html",
    imports: [LottieComponent, MatAnchor, ImageCaptureDirective, AnalyticsDirective, MatButton, Dir, ImageAttributionComponent]
})
export class ImageScrollerComponent implements OnChanges {
    public readonly lottiePOI: AnimationOptions = {
        path: "content/lottie/placeholder-scenery.json"
    };

    private currentIndex = signal(0);

    public readonly images = model<string[]>();
    public canEdit = input<boolean>();

    public currentImageChanged = output<string>();

    public readonly resources = inject(ResourcesService);

    private readonly fileService = inject(FileService);
    private readonly imageGalleryService = inject(ImageGalleryService);
    private readonly imageResizeService = inject(ImageResizeService);

    public readonly hasNext = computed(() => this.currentIndex() < this.images().length - 1);

    public readonly hasPrevious = computed(() => this.currentIndex() > 0);

    public readonly getCurrentValue = computed(() => {
        if (this.images().length === 0) {
            return null;
        }
        return this.images()[this.currentIndex()];
    });

    public readonly getIndexString = computed(() => `${this.currentIndex() + 1} / ${this.images().length}`);

    public ngOnChanges(changes: SimpleChanges<ImageScrollerComponent>): void {
        if (changes.images) {
            this.currentIndex.set(0);
        }
    }

    public next() {
        this.currentIndex.set(this.currentIndex() + 1);
        if (this.currentIndex() >= this.images().length) {
            this.currentIndex.set(this.images().length - 1);
        }
        this.currentImageChanged.emit(this.getCurrentValue());
    }

    public previous() {
        this.currentIndex.set(this.currentIndex() - 1);
        if (this.currentIndex() < 0) {
            this.currentIndex.set(0);
        }
        this.currentImageChanged.emit(this.getCurrentValue());
    }

    public remove(): void {
        const indexToRemove = this.currentIndex();
        this.images.update(images => images.filter((_, index) => index !== indexToRemove));
        this.previous();
    }

    public onFileInputChanged(event: Event | HTMLElementInputChangeEvent) {
        this.onFileDrop(event);
    }

    public async onFileDrop(event: DragEvent | Event | HTMLElementInputChangeEvent) {
        event.preventDefault();
        if (this.canEdit() === false) {
            return;
        }
        const files = this.fileService.getFilesFromEvent(event);
        for (const file of files) {
            const data = await this.imageResizeService.resizeImage(file);
            this.images.update(images => [...images, data]);
            this.currentIndex.set(this.images().length - 1);
            this.currentImageChanged.emit(this.getCurrentValue());
        }
    }

    public getCurrentImage() {
        const imageUrl = this.getCurrentValue();
        if (imageUrl == null) {
            return null;
        }
        return this.resources.getResizedImageUrl(imageUrl, 960)
    }

    public showImage() {
        const imagesUrls = [];
        for (const imageUrl of this.images()) {
            const imageUrlToPush = this.resources.getResizedImageUrl(imageUrl, 1920);
            imagesUrls.push(imageUrlToPush);
        }
        this.imageGalleryService.open(imagesUrls, this.currentIndex());
    }
}
