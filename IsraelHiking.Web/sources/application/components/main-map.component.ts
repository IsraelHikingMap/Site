import { Component, ViewChild, AfterViewInit, ViewEncapsulation } from "@angular/core";
import { NgxImageGalleryComponent } from "ngx-image-gallery";
import { select, NgRedux } from "@angular-redux/store";
import { Observable } from "rxjs";
import { proj } from "openlayers";
import { MapComponent } from "ngx-openlayers";

import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { ImageGalleryService } from "../services/image-gallery.service";
import { ApplicationState, Location } from "../models/models";
import { SetLocationAction } from "../reducres/location.reducer";
import { HashService } from "../services/hash.service";
import { MapService } from "../services/map.service";
import { RunningContextService } from "../services/running-context.service";

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

    @select((state: ApplicationState) => state.location)
    public location: Observable<Location>;

    constructor(resources: ResourcesService,
        public readonly imageGalleryService: ImageGalleryService,
        private readonly mapService: MapService,
        private readonly hashService: HashService,
        private readonly runningContextService: RunningContextService,
        private readonly ngRedux: NgRedux<ApplicationState>,

    ) {
        super(resources);
    }

    public moveEnd(e: ol.MapEvent) {
        if (!e) {
            return;
        }
        console.log("moveend");
        let centerLatLon = proj.toLonLat(e.map.getView().getCenter());
        let action = new SetLocationAction({
            longitude: centerLatLon[0],
            latitude: centerLatLon[1],
            zoom: e.map.getView().getZoom()
        });
        this.ngRedux.dispatch(action);

        if (!this.hashService.getShareUrlId() && !this.hashService.getUrl() && !this.hashService.getPoiRouterData()) {
            this.hashService.resetAddressbar();
        }
    }

    public ngAfterViewInit(): void {
        this.imageGalleryService.setGalleryComponent(this.ngxImageGallery);
        this.mapService.setMap(this.mapComponent.instance);
    }

    public isMobile() {
        return this.runningContextService.isMobile;
    }

    public isIFrame() {
        return this.runningContextService.isIFrame;
    }
}