import { Injectable, Injector } from "@angular/core";
import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";

import { PhotoSwpieComponent, PHOTO_SWIPE_DATA } from "../components/photoswipe.component";
import { ResourcesService } from "./resources.service";

@Injectable()
export class ImageGalleryService {

    constructor(private readonly overlay: Overlay,
        private readonly resourcesService: ResourcesService) { 

    }

    public open(urls: string[], index: number) {
        if (this.resourcesService.getCurrentLanguageCodeSimplified() == "he") {
            urls = [...urls].reverse();
            index = urls.length - 1 - index;
        }
        let overlayRef = this.overlay.create({
              hasBackdrop: false,
              positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
              scrollStrategy: this.overlay.scrollStrategies.block()
        });
        let injector = Injector.create({
            providers: [
                { provide: OverlayRef, useValue: overlayRef },
                { provide: PHOTO_SWIPE_DATA, useValue: {
                    imageUrls: urls,
                    index: index
                }}
            ]
        });

        let photoSwpieComponent = new ComponentPortal(PhotoSwpieComponent, null, injector);
        
        // Attach ComponentPortal to PortalHost
        overlayRef.attach(photoSwpieComponent);
    }
}
