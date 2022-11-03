import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from "@angular/core";
import { AnimationOptions } from "ngx-lottie";

import { BaseMapComponent } from "../../base-map.component";
import { ResourcesService } from "../../../services/resources.service";
import { FileService } from "../../../services/file.service";
import { ImageGalleryService } from "../../../services/image-gallery.service";
import { ImageResizeService } from "../../../services/image-resize.service";
import { RunningContextService } from "../../../services/running-context.service";
import sceneryPlaceholder from "../../../../content/lottie/placeholder-scenery.json";

@Component({
    selector: "image-scroller",
    templateUrl: "./image-scroller.component.html"
})
export class ImageScrollerComponent extends BaseMapComponent implements OnChanges {
    lottiePOI: AnimationOptions = {
        animationData: sceneryPlaceholder,
    };

    private currentIndex: number;

    @Input()
    public images: string[];

    @Input()
    public canEdit: boolean;

    @Output()
    public currentImageChanged: EventEmitter<string>;

    constructor(resources: ResourcesService,
                private readonly fileService: FileService,
                private readonly runningContextService: RunningContextService,
                private readonly imageGalleryService: ImageGalleryService,
                private readonly imageResizeService: ImageResizeService) {
        super(resources);
        this.currentIndex = 0;
        this.currentImageChanged = new EventEmitter();
    }
    
    public ngOnChanges(changes: SimpleChanges): void {
        if (changes.images) {
            this.currentIndex = 0;
        }
    }

    public next() {
        this.currentIndex++;
        if (this.currentIndex >= this.images.length) {
            this.currentIndex = this.images.length - 1;
        }
        this.currentImageChanged.next(this.getCurrentValue());
    }

    public previous() {
        this.currentIndex--;
        if (this.currentIndex < 0) {
            this.currentIndex = 0;
        }
        this.currentImageChanged.next(this.getCurrentValue());
    }

    public hasNext(): boolean {
        return this.currentIndex < this.images.length - 1;
    }

    public hasPrevious(): boolean {
        return this.currentIndex > 0;
    }

    public remove(): void {
        this.images.splice(this.currentIndex, 1);
        this.previous();
    }

    public async add(e: any) {
        if (this.canEdit === false) {
            return;
        }
        let files = this.fileService.getFilesFromEvent(e);
        for (let file of files) {
            let data = await this.imageResizeService.resizeImage(file);
            this.images.push(data);
            this.currentIndex = this.images.length - 1;
            this.currentImageChanged.next(this.getCurrentValue());
        }
    }

    public getCurrentValue(): string {
        if (this.images.length === 0) {
            return null;
        }
        return this.images[this.currentIndex];
    }

    public getCurrentImage() {
        let imageUrl = this.getCurrentValue();
        if (imageUrl == null) {
            return null;
        }
        return this.runningContextService.isOnline
            ? this.resources.getResizedImageUrl(imageUrl, 800)
            : imageUrl;
    }

    public showImage() {
        if (!this.runningContextService.isOnline) {
            return;
        }
        let imagesUrls = [];
        for (let imageUrl of this.images) {
            let imageUrlToPush = this.resources.getResizedImageUrl(imageUrl, 1600);
            imagesUrls.push(imageUrlToPush);
        }
        this.imageGalleryService.open(imagesUrls, this.currentIndex);
    }

    public getIndexString() {
        return `${this.currentIndex + 1} / ${this.images.length}`;
    }
}
