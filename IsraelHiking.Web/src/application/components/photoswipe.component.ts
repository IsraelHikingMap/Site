import { Component, ElementRef, AfterViewInit, InjectionToken, ViewEncapsulation, EventEmitter, viewChild, inject } from "@angular/core";


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
export class PhotoSwpieComponent implements AfterViewInit {

    public readonly photoswipe = viewChild<ElementRef>("photoswipe");
    public readonly closed = new EventEmitter();
    private readonly data = inject(PHOTO_SWIPE_DATA);

    public async ngAfterViewInit(): Promise<void> {
        // photoswipe is only worth downloading once an image gallery is actually opened.
        const { default: PhotoSwipe } = await import("photoswipe");
        const pswpElement = this.photoswipe().nativeElement;

        const dataSource = this.data.imageUrls.map(imageUrl => ({
            src: imageUrl
        }));

        const pswp = new PhotoSwipe({
            appendToEl: pswpElement,
            dataSource,
            index: this.data.index,
            closeOnVerticalDrag: false,
            pinchToClose: false,
            maxZoomLevel: 8
        });

        pswp.on("destroy", () => this.closed.emit());
        pswp.on("beforeOpen", () => {
            const ds = pswp?.options?.dataSource as { src: string; width?: number; height?: number }[];
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
