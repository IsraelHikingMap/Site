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
        let pswpElement = this.photoswipe.nativeElement;

        let dataSource = this.data.imageUrls.map(imageUrl => ({
            src: imageUrl,
        }));

        let pswp = new PhotoSwipe({
            appendToEl: pswpElement,
            dataSource,
            index: this.data.index,
            closeOnVerticalDrag: false,
            pinchToClose: false,
            maxZoomLevel: 8,

        });
        
        pswp.on("destroy", () => this.closed.emit());
        pswp.init();
    }
}
