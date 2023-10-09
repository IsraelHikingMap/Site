import { Component, ElementRef, ViewChild, AfterViewInit, InjectionToken, Inject, ViewEncapsulation, EventEmitter } from "@angular/core";
import PhotoSwipe from "photoswipe";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";

export const PHOTO_SWIPE_DATA = new InjectionToken<PhotoSwipeData>("PHOTO_SWIPE_DATA");

export type PhotoSwipeData = {
    imageUrls: string[];
    index: number;
};

@Component({
    selector: "photoswipe",
    templateUrl: "./photoswipe.component.html",
    styleUrls: ["./photoswipe.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class PhotoSwpieComponent extends BaseMapComponent implements AfterViewInit{

    @ViewChild("photoswipe")
    public photoswipe: ElementRef;
    public closed: EventEmitter<void>;

    private data: PhotoSwipeData;

    constructor(resources: ResourcesService,
                @Inject(PHOTO_SWIPE_DATA) data: PhotoSwipeData) {
        super(resources);
        this.data = data;
        this.closed = new EventEmitter();
    }

    public ngAfterViewInit(): void {
        const pswpElement = this.photoswipe.nativeElement;

        const dataSource = this.data.imageUrls.map(imageUrl => ({
            src: imageUrl,
        }));

        const pswp = new PhotoSwipe({
            appendToEl: pswpElement,
            dataSource,
            index: this.data.index,
            closeOnVerticalDrag: false,
            pinchToClose: false,
            maxZoomLevel: 8,
        });

        pswp.on("destroy", () => this.closed.emit());
        pswp.on("beforeOpen", () => {
            const ds = pswp?.options?.dataSource as any[];
              for (let idx = 0; idx < ds.length; idx++) {
                const item = ds[idx];
                const img = new Image();
                img.onload = () => {
                  item.width = img.naturalWidth;
                  item.height = img.naturalHeight;
                  pswp?.refreshSlideContent(idx);
                };
                img.src = item.src;
            }
        });
        pswp.init();
    }
}
