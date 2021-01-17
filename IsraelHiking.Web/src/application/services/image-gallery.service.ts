import { Injectable } from "@angular/core";
import { Gallery, Image } from "angular-gallery";

@Injectable()
export class ImageGalleryService {

    constructor(private readonly gallery: Gallery) { }

    public open(urls: string[], index?: number) {
        let images = [];
        // direction of next image is opposite from current UI implementation - thus reverting order
        for (let url of urls) {            
            images.unshift({ path: url } as Image);
        }
        this.gallery.load({ images, index: urls.length -1 -index });
    }
}
