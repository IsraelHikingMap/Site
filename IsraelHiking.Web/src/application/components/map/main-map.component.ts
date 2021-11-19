import { Component, ViewChild, ViewEncapsulation, ViewChildren, QueryList, ElementRef } from "@angular/core";
import { MapComponent, CustomControl } from "ngx-maplibre-gl";
import mapliregl, { StyleSpecification, ScaleControl, Unit } from "maplibre-gl";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { HashService } from "../../services/hash.service";
import { MapService } from "../../services/map.service";
import { RunningContextService } from "../../services/running-context.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { NgRedux } from "../../reducers/infra/ng-redux.module";
import { SetLocationAction } from "../../reducers/location.reducer";
import type { ApplicationState, Location } from "../../models/models";

@Component({
    selector: "main-map",
    templateUrl: "./main-map.component.html",
    styleUrls: ["./main-map.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class MainMapComponent extends BaseMapComponent {

    @ViewChild(MapComponent)
    public mapComponent: MapComponent;

    @ViewChildren("topLeftControl", { read: ElementRef })
    public topLeftControls: QueryList<ElementRef>;

    @ViewChildren("topRightControl", { read: ElementRef })
    public topRightControls: QueryList<ElementRef>;

    @ViewChildren("bottomLeftControl", { read: ElementRef })
    public bottomLeftControls: QueryList<ElementRef>;

    @ViewChildren("bottomRightControl", { read: ElementRef })
    public bottomRightControls: QueryList<ElementRef>;

    public location: Location;
    public initialStyle: StyleSpecification;

    constructor(resources: ResourcesService,
                public readonly imageGalleryService: ImageGalleryService,
                private readonly mapService: MapService,
                private readonly hashService: HashService,
                private readonly runningContextService: RunningContextService,
                private readonly defaultStyleService: DefaultStyleService,
                private readonly ngRedux: NgRedux<ApplicationState>,

    ) {
        super(resources);
        this.location = this.ngRedux.getState().location;
        this.initialStyle = { ...this.defaultStyleService.style };
        this.initialStyle.sources = {
            dummy: {
                type: "geojson",
                data: {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "Point",
                        coordinates: [0, 0]
                    }
                }
            }
        };
        this.initialStyle.layers = [
            {
                id: this.resources.endOfBaseLayer,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            },
            {
                id: this.resources.endOfOverlays,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            },
            {
                id: this.resources.endOfClusters,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            },
            {
                id: this.resources.endOfRoutes,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            }
        ];
    }

    public moveEnd(e: DragEvent) {
        if (!e) {
            return;
        }
        let centerLatLon = this.mapComponent.mapInstance.getCenter();
        this.ngRedux.dispatch(new SetLocationAction({
            longitude: centerLatLon.lng,
            latitude: centerLatLon.lat,
            zoom: this.mapComponent.mapInstance.getZoom()
        }));
        this.hashService.resetAddressbar();
    }

    public mapLoaded() {
        mapliregl.setRTLTextPlugin("./mapbox-gl-rtl-text.js", () => {});

        this.mapService.setMap(this.mapComponent.mapInstance);

        this.topLeftControls.forEach(c => {
            this.mapComponent.mapInstance.addControl(new CustomControl(c.nativeElement), "top-left");
        });
        this.topRightControls.forEach(c => {
            this.mapComponent.mapInstance.addControl(new CustomControl(c.nativeElement), "top-right");
        });
        this.bottomLeftControls.forEach(c => {
            this.mapComponent.mapInstance.addControl(new CustomControl(c.nativeElement), "bottom-left");
        });
        this.bottomRightControls.forEach(c => {
            this.mapComponent.mapInstance.addControl(new CustomControl(c.nativeElement), "bottom-right");
        });
        this.mapComponent.mapInstance.addControl(new ScaleControl({ unit: "meter" as Unit}), "bottom-left");
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
