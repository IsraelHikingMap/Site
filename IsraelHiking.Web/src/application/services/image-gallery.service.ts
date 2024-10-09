import { inject, Injectable, Injector } from "@angular/core";
import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";

import { PhotoSwpieComponent, PHOTO_SWIPE_DATA } from "../components/photoswipe.component";
import { ResourcesService } from "./resources.service";

@Injectable()
export class ImageGalleryService {
    private overlayRef: OverlayRef = null;

    private readonly overlay = inject(Overlay);
    private readonly resourcesService = inject(ResourcesService);

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
        const injector = Injector.create({
            providers: [
                { provide: OverlayRef, useValue: this.overlayRef },
                { provide: PHOTO_SWIPE_DATA, useValue: {
                    imageUrls: urls,
                    index
                }}
            ]
        });

        const photoSwpieComponent = new ComponentPortal(PhotoSwpieComponent, null, injector);

        const componentRef = this.overlayRef.attach(photoSwpieComponent);
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
