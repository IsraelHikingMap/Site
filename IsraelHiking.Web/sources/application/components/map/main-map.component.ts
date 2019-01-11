import { Component, ViewChild, AfterViewInit, ViewEncapsulation } from "@angular/core";
import { NgxImageGalleryComponent } from "ngx-image-gallery";
import { NgRedux } from "@angular-redux/store";
import { MapComponent } from "ngx-openlayers";

import { ResourcesService } from "../../services/resources.service";
import { BaseMapComponent } from "../base-map.component";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { ApplicationState, Location } from "../../models/models";
import { SetLocationAction } from "../../reducres/location.reducer";
import { HashService } from "../../services/hash.service";
import { MapService } from "../../services/map.service";
import { RunningContextService } from "../../services/running-context.service";
import { SnappingService } from "../../services/snapping.service";
import { SpatialService } from "../../services/spatial.service";

@Component({
    selector: "main-map",
    templateUrl: "./main-map.component.html",
    styleUrls: ["./main-map.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class MainMapComponent extends BaseMapComponent implements AfterViewInit {

    @ViewChild(NgxImageGalleryComponent)
    public ngxImageGallery: NgxImageGalleryComponent;

    @ViewChild(MapComponent)
    public mapComponent: MapComponent;

    public location: Location;

    constructor(resources: ResourcesService,
        public readonly imageGalleryService: ImageGalleryService,
        private readonly mapService: MapService,
        private readonly snappingService: SnappingService,
        private readonly hashService: HashService,
        private readonly runningContextService: RunningContextService,
        private readonly ngRedux: NgRedux<ApplicationState>,

    ) {
        super(resources);
        this.location = this.ngRedux.getState().location;
    }

    public moveEnd(e: ol.MapEvent) {
        if (!e) {
            return;
        }
        let centerLatLon = SpatialService.fromViewCoordinate(e.map.getView().getCenter());
        let currentLocation = { lat: this.location.latitude, lng: this.location.longitude };
        if (SpatialService.getDistanceInMeters(centerLatLon, currentLocation) < 1) {
            return;
        }
        this.ngRedux.dispatch(new SetLocationAction({
            longitude: centerLatLon.lng,
            latitude: centerLatLon.lat,
            zoom: e.map.getView().getZoom()
        }));
        this.hashService.resetAddressbar();
    }

    public ngAfterViewInit(): void {
        this.imageGalleryService.setGalleryComponent(this.ngxImageGallery);
        this.mapService.setMap(this.mapComponent.instance);
        this.snappingService.setMap(this.mapComponent.instance);
    }

    public isMobile() {
        return this.runningContextService.isMobile;
    }

    public isIFrame() {
        return this.runningContextService.isIFrame;
    }

    public isApp() {
        return this.runningContextService.isCordova;
    }
}