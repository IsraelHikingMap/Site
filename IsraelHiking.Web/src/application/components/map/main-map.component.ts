import { Component, ViewChild, ViewEncapsulation, ViewChildren, QueryList, ElementRef } from "@angular/core";
import { MatDialog, MatDialogConfig } from "@angular/material/dialog";
import { MapComponent, CustomControl } from "@maplibre/ngx-maplibre-gl";
import mapliregl, { StyleSpecification, ScaleControl, Unit, RasterDEMSourceSpecification, PointLike } from "maplibre-gl";
import { NgRedux } from "@angular-redux2/store";

import { BaseMapComponent } from "../base-map.component";
import { TracesDialogComponent } from "../dialogs/traces-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { IHMTitleService } from "../../services/ihm-title.service";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { HashService } from "../../services/hash.service";
import { MapService } from "../../services/map.service";
import { RunningContextService } from "../../services/running-context.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { SetLocationAction } from "../../reducers/location.reducer";
import type { ApplicationState, LocationState } from "../../models/models";

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

    public location: LocationState;
    public initialStyle: StyleSpecification;
    private isTerrainOn: boolean;

    constructor(resources: ResourcesService,
                private readonly titleService: IHMTitleService,
                public readonly imageGalleryService: ImageGalleryService,
                private readonly mapService: MapService,
                private readonly hashService: HashService,
                private readonly runningContextService: RunningContextService,
                private readonly defaultStyleService: DefaultStyleService,
                private readonly dialog: MatDialog,
                private readonly ngRedux: NgRedux<ApplicationState>,

    ) {
        super(resources);
        this.location = this.ngRedux.getState().location;
        this.isTerrainOn = false;
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
        this.titleService.clear();
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

        this.mapComponent.mapInstance.on("click", (e) => {
            // This is used for the personal heatmap, assuming there's a layer there called "record_lines".
            const bbox = [
                [e.point.x - 5, e.point.y - 5],
                [e.point.x + 5, e.point.y + 5]
            ] as [PointLike, PointLike];
            let features = this.mapComponent.mapInstance.queryRenderedFeatures(bbox).filter(f => f.sourceLayer === "record_lines");
            if (features.length <= 0) { return; }
            this.dialog.open(TracesDialogComponent, { width: "480px", data: features.map(f => f.properties.trace_id) } as MatDialogConfig);
        });
    }

    public isMobile() {
        return this.runningContextService.isMobile;
    }

    public isIFrame() {
        return this.runningContextService.isIFrame;
    }

    public isApp() {
        return this.runningContextService.isCapacitor;
    }

    public pitchChanged() {
        let pitch = this.mapComponent.mapInstance.getPitch();
        if (pitch <= 10 && !this.isTerrainOn) {
            // Terrain is off and pitch is low, nothing to do.
            return;
        }

        if (pitch > 10 && this.isTerrainOn) {
            // Terrain is on and pitch is high, nothing to do.
            return;
        }

        if (pitch <= 10 && this.isTerrainOn) {
            // Terrain is on and pitch is low, turning off.
            this.isTerrainOn = false;
            this.mapComponent.mapInstance.setTerrain(null);
            return;
        }

        // Terrain is off and pitch is high, turning on.
        this.isTerrainOn = true;
        let source: RasterDEMSourceSpecification = {
            type: "raster-dem",
            url: "https://israelhiking.osm.org.il/vector/data/TerrainRGB.json",
            tileSize: 256
        };
        if (this.ngRedux.getState().offlineState.lastModifiedDate != null) {
            // Using offline source
            source = {
                type: "raster-dem",
                tiles:["custom://TerrainRGB/{z}/{x}/{y}.png"],
                maxzoom:12,
                minzoom:7
            };
        }
        let currentSourceTerrain = this.mapComponent.mapInstance.getSource("terrain");
        if (!currentSourceTerrain) {
            this.mapComponent.mapInstance.addSource("terrain", source);
        } else if (currentSourceTerrain && currentSourceTerrain.serialize().url !== source.url) {
            this.mapComponent.mapInstance.removeSource("terrain");
            this.mapComponent.mapInstance.addSource("terrain", source);
        }
        this.mapComponent.mapInstance.setTerrain({source: "terrain", exaggeration: 2});
    }

}
