import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import * as _ from "lodash";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { IRouteLayer, IMarkerWithData } from "../../services/layers/routelayers/iroute.layer";
import { OsmUserService } from "../../services/osm-user.service";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { PrivatePoiUploaderService } from "../../services/private-poi-uploader.service";
import { LinkData } from "../../models/models";

@Component({
    selector: "drawing-poi-marker-popup",
    templateUrl: "./drawing-poi-marker-popup.component.html"
})
export class DrawingPoiMarkerPopupComponent extends BaseMarkerPopupComponent {
    public markerType: string;
    public description: string;
    public imageLink: LinkData;

    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        elevationProvider: ElevationProvider,
        private readonly osmUserService: OsmUserService,
        private readonly imageGalleryService: ImageGalleryService,
        private readonly privatePoiUploaderService: PrivatePoiUploaderService) {
        super(resources, httpClient, elevationProvider);

        this.imageLink = null;
    }

    public setRouteLayer(routeLayer: IRouteLayer) {
        let routeMarker = _.find(routeLayer.route.markers, markerToFind => markerToFind.latlng.lat === this.latLng.lat &&
            markerToFind.latlng.lng === this.latLng.lng) as IMarkerWithData;
        this.markerType = routeMarker.type;
        this.description = routeMarker.description;
        let url = _.find(routeMarker.urls, u => u.mimeType.startsWith("image"));
        this.imageLink = url;
    }

    public showUploadPointButton(): boolean {
        return this.osmUserService.isLoggedIn();
    }

    public async uploadPoint(e: Event) {
        this.suppressEvents(e);
        await await this.privatePoiUploaderService.uploadPoint(
            this.latLng,
            this.imageLink,
            this.title,
            this.description,
            this.markerType);

        this.close();
    }

    public showImage() {
        if (this.imageLink && this.imageLink.url) {
            this.imageGalleryService.setImages([this.imageLink.url]);
        }
    }

    public changeToEditMode = (): void => { throw new Error("Callback needs to be set by the creating class..."); };
}