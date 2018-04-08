import { Injectable } from "@angular/core";
import { NgxImageGalleryComponent, GALLERY_IMAGE, GALLERY_CONF } from "ngx-image-gallery";

import { MapService } from "./map.service";


@Injectable()
export class ImageGalleryService
{
    public config: GALLERY_CONF;
    public images: GALLERY_IMAGE[] = [];

    private galleryComponent: NgxImageGalleryComponent;

    constructor(private readonly mapService: MapService) {
        this.config = {
            imageOffset: "0px",
            showDeleteControl: false,
            showImageTitle: false,
        };
        this.images = [{ url: "https://user-images.githubusercontent.com/3269297/37312048-2d6e7488-2652-11e8-9dbe-c1465ff2e197.png" }];
    }

    public setGalleryComponent(galleryComponent: NgxImageGalleryComponent) {
        this.galleryComponent = galleryComponent;
        galleryComponent.onOpen.subscribe(() => {
            this.mapService.map.dragging.disable();
            this.mapService.map.scrollWheelZoom.disable();
            this.mapService.map.touchZoom.disable();
            this.mapService.map.boxZoom.disable();
        });
        galleryComponent.onClose.subscribe(() => {
            this.mapService.map.dragging.enable();
            this.mapService.map.scrollWheelZoom.enable();
            this.mapService.map.touchZoom.enable();
            this.mapService.map.boxZoom.enable();
        });
    }

    public setImages(urls: string[]) {
        this.images = [];
        for (let url of urls) {
            this.images.push({ url: url });
        }
        this.galleryComponent.conf.showThumbnails = this.images.length > 1;
        this.galleryComponent.open();
    }
}