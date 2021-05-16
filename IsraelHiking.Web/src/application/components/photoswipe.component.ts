import { Component, ElementRef, ViewChild, AfterViewInit, InjectionToken, Inject, ViewEncapsulation, EventEmitter } from "@angular/core";
import { OverlayRef } from "@angular/cdk/overlay";
import * as PhotoSwipe from "photoswipe";
import * as PhotoSwipeUI_Default from "photoswipe/dist/photoswipe-ui-default";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";

export const PHOTO_SWIPE_DATA = new InjectionToken<PhotoSwipeData>("PHOTO_SWIPE_DATA");

export interface PhotoSwipeData {
    imageUrls: string[];
    index: number;
}

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
                private readonly overlayRef: OverlayRef,
                @Inject(PHOTO_SWIPE_DATA) data) {
        super(resources);
        this.data = data;
        this.closed = new EventEmitter();
    }

    public ngAfterViewInit(): void {
        let pswpElement = this.photoswipe.nativeElement;

        let items = this.data.imageUrls.map(i => ({
            src: i,
            w: window.innerWidth,
            h: window.innerHeight
        }));

        let options = {
            index: this.data.index,
            closeOnScroll: false,
            pinchToClose: false,
            history: false,
            captionEl: false,
            fullscreenEl: false,
            shareEl: false,
            zoomEl: false,
            maxSpreadZoom: 8
        };

        // Initializes and opens PhotoSwipe
        let pswp = new PhotoSwipe(pswpElement, PhotoSwipeUI_Default, items, options);
        pswp.listen("destroy", () => this.closed.emit());
        pswp.init();
    }
}
