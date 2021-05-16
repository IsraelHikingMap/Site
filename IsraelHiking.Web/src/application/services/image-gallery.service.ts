import { Injectable, Injector } from "@angular/core";
import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";

import { PhotoSwpieComponent, PHOTO_SWIPE_DATA } from "../components/photoswipe.component";
import { ResourcesService } from "./resources.service";

@Injectable()
export class ImageGalleryService {
    private overlayRef: OverlayRef;

    constructor(private readonly overlay: Overlay,
                private readonly resourcesService: ResourcesService) {
            this.overlayRef = null;

    }

    public open(urls: string[], index: number) {
        if (this.resourcesService.getCurrentLanguageCodeSimplified() === "he") {
            urls = [...urls].reverse();
            index = urls.length - 1 - index;
        }
        if (this.overlayRef) {
            this.overlayRef.dispose();
        }
        this.overlayRef = this.overlay.create({
              hasBackdrop: false,
              positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
              scrollStrategy: this.overlay.scrollStrategies.block()
        });
        let injector = Injector.create({
            providers: [
                { provide: OverlayRef, useValue: this.overlayRef },
                { provide: PHOTO_SWIPE_DATA, useValue: {
                    imageUrls: urls,
                    index
                }}
            ]
        });

        let photoSwpieComponent = new ComponentPortal(PhotoSwpieComponent, null, injector);

        let componentRef = this.overlayRef.attach(photoSwpieComponent);
        componentRef.instance.closed.subscribe(() => this.close());
    }

    public isOpen(): boolean {
        return this.overlayRef != null;
    }

    public close() {
        if (this.overlayRef) {
            this.overlayRef.dispose();
            this.overlayRef = null;
        }
    }
}
