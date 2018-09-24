import { Component, ApplicationRef } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import * as _ from "lodash";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { IRouteLayer, IMarkerWithData } from "../../services/layers/routelayers/iroute.layer";
import { OsmUserService } from "../../services/osm-user.service";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { PrivatePoiUploaderService } from "../../services/private-poi-uploader.service";
import * as Common from "../../common/IsraelHiking";


@Component({
    selector: "drawing-poi-marker-popup",
    templateUrl: "./drawing-poi-marker-popup.component.html"
})
export class DrawingPoiMarkerPopupComponent extends BaseMarkerPopupComponent {
    public markerType: string;
    public description: string;
    public imageLink: Common.LinkData;

    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        elevationProvider: ElevationProvider,
        applicationRef: ApplicationRef,
        private readonly osmUserService: OsmUserService,
        private readonly imageGalleryService: ImageGalleryService,
        private readonly privatePoiUploaderService: PrivatePoiUploaderService) {
        super(resources, httpClient, applicationRef, elevationProvider);

        this.imageLink = null;
    }

    public setRouteLayer(routeLayer: IRouteLayer) {
        let routeMarker = _.find(routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker) as IMarkerWithData;
        this.markerType = routeMarker.type;
        this.description = routeMarker.description;
        let url = _.find(routeMarker.urls, u => u.mimeType.startsWith("image"));
        this.imageLink = url;
    }

    public setMarker(marker: Common.IMarkerWithTitle) {
        this.setMarkerInternal(marker);
    }

    public showUploadPointButton(): boolean {
        return this.osmUserService.isLoggedIn();
    }

    public async uploadPoint(e: Event) {
        this.suppressEvents(e);
        await await this.privatePoiUploaderService.uploadPoint(
            this.marker,
            this.imageLink,
            this.title,
            this.description,
            this.markerType);

        this.marker.closePopup();
    }

    public showImage() {
        if (this.imageLink && this.imageLink.url) {
            this.imageGalleryService.setImages([this.imageLink.url]);
        }
    }

    public changeToEditMode = (): void => { throw new Error("Callback needs to be set by the creating class..."); };
}