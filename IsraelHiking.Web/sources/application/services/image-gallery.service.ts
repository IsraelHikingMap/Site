import { Injectable } from "@angular/core";
import { NgxImageGalleryComponent, GALLERY_IMAGE, GALLERY_CONF } from "ngx-image-gallery";


@Injectable()
export class ImageGalleryService
{
    public config: GALLERY_CONF;
    public images: GALLERY_IMAGE[] = [];

    private galleryComponent: NgxImageGalleryComponent;

    constructor() {
        this.config = {
            imageOffset: "0px",
            showDeleteControl: false,
            showImageTitle: false,
        };
        this.images = [{ url: "https://user-images.githubusercontent.com/3269297/37312048-2d6e7488-2652-11e8-9dbe-c1465ff2e197.png" }];
    }

    public setGalleryComponent(galleryComponent: NgxImageGalleryComponent) {
        this.galleryComponent = galleryComponent;
    }

    public setImages(urls: string[]) {
        this.images = [];
        for (let url of urls) {
            this.images.push({ url: url });
        }
        this.galleryComponent.open();
    }
}