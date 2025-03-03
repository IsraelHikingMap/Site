import { Component, ViewEncapsulation, ElementRef, inject, viewChild, viewChildren } from "@angular/core";
import { MatDialog, MatDialogConfig } from "@angular/material/dialog";
import { NgStyle, NgIf } from "@angular/common";
import { MapComponent, CustomControl } from "@maplibre/ngx-maplibre-gl";
import { setRTLTextPlugin, StyleSpecification, ScaleControl, Unit, RasterDEMSourceSpecification, PointLike } from "maplibre-gl";
import { NgProgressbar } from "ngx-progressbar";
import { NgProgressHttp } from "ngx-progressbar/http";
import { Store } from "@ngxs/store";

import { TracesDialogComponent } from "../dialogs/traces-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { IHMTitleService } from "../../services/ihm-title.service";
import { MapService } from "../../services/map.service";
import { RunningContextService } from "../../services/running-context.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { SetLocationAction } from "../../reducers/location.reducer";
import type { ApplicationState, LocationState } from "../../models/models";
import { SidebarComponent } from "../sidebar/sidebar.component";
import { BackgroundTextComponent } from "../background-text.component";
import { LayersViewComponent } from "./layers-view.component";
import { RoutesComponent } from "./routes.component";
import { RecordedRouteComponent } from "./recorded-route.component";
import { TracesComponent } from "./traces.component";
import { ZoomComponent } from "../zoom.component";
import { LocationComponent } from "../location.component";
import { MainMenuComponent } from "../main-menu.component";
import { SearchComponent } from "../search.component";
import { DrawingComponent } from "../drawing.component";
import { RouteStatisticsComponent } from "../route-statistics.component";
import { CenterMeComponent } from "../center-me.component";
import { IhmLinkComponent } from "../ihm-link.component";

@Component({
    selector: "main-map",
    templateUrl: "./main-map.component.html",
    styleUrls: ["./main-map.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [NgProgressbar, NgProgressHttp, NgStyle, SidebarComponent, BackgroundTextComponent, MapComponent, LayersViewComponent, RoutesComponent, RecordedRouteComponent, TracesComponent, ZoomComponent, NgIf, LocationComponent, MainMenuComponent, SearchComponent, DrawingComponent, RouteStatisticsComponent, CenterMeComponent, IhmLinkComponent]
})
export class MainMapComponent {

    public mapComponent = viewChild(MapComponent);
    public topLeftControls = viewChildren("topLeftControl", { read: ElementRef });
    public topRightControls = viewChildren("topRightControl", { read: ElementRef });
    public bottomLeftControls = viewChildren("bottomLeftControl", { read: ElementRef });
    public bottomRightControls = viewChildren("bottomRightControl", { read: ElementRef });

    public location: LocationState;
    public initialStyle: StyleSpecification;
    private isTerrainOn: boolean = false;

    public readonly resources = inject(ResourcesService);

    private readonly titleService = inject(IHMTitleService);
    private readonly mapService = inject(MapService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly dialog = inject(MatDialog);
    private readonly store = inject(Store);

    constructor() {
        
        this.location = this.store.selectSnapshot((s: ApplicationState) => s.locationState);
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
        const centerLatLon = this.mapComponent().mapInstance.getCenter();
        this.store.dispatch(new SetLocationAction(centerLatLon.lng, centerLatLon.lat, this.mapComponent().mapInstance.getZoom()));
    }

    public mapLoaded() {
        setRTLTextPlugin("./mapbox-gl-rtl-text.js", false);

        this.mapService.setMap(this.mapComponent().mapInstance);

        for (const c of this.topLeftControls()) {
            this.mapComponent().mapInstance.addControl(new CustomControl(c.nativeElement), "top-left");
        }
        for (const c of this.topRightControls()) {
            this.mapComponent().mapInstance.addControl(new CustomControl(c.nativeElement), "top-right");
        }
        this.mapComponent().mapInstance.addControl(new ScaleControl({ unit: "meter" as Unit}), "bottom-left");
        for (const c of this.bottomLeftControls()) {
            this.mapComponent().mapInstance.addControl(new CustomControl(c.nativeElement), "bottom-left");
        }
        for (const c of this.bottomRightControls()) {
            this.mapComponent().mapInstance.addControl(new CustomControl(c.nativeElement), "bottom-right");
        }

        this.mapComponent().mapInstance.on("click", (e) => {
            // This is used for the personal heatmap, assuming there's a layer there called "record_lines".
            const bbox = [
                [e.point.x - 5, e.point.y - 5],
                [e.point.x + 5, e.point.y + 5]
            ] as [PointLike, PointLike];
            const features = this.mapComponent().mapInstance.queryRenderedFeatures(bbox).filter(f => f.sourceLayer === "record_lines");
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
        if (this.runningContextService.isMobile) {
            return;
        }
        const pitch = this.mapComponent().mapInstance.getPitch();
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
            this.mapComponent().mapInstance.setTerrain(null);
            return;
        }

        // Terrain is off and pitch is high, turning on.
        this.isTerrainOn = true;
        let source: RasterDEMSourceSpecification = {
            type: "raster-dem",
            url: "https://israelhiking.osm.org.il/vector/data/TerrainRGB.json",
            tileSize: 256
        };
        if (this.store.selectSnapshot((s: ApplicationState) => s.offlineState).lastModifiedDate != null) {
            // Using offline source
            source = {
                type: "raster-dem",
                tiles:["custom://TerrainRGB/{z}/{x}/{y}.png"],
                maxzoom:12,
                minzoom:7
            };
        }
        const currentSourceTerrain = this.mapComponent().mapInstance.getSource("terrain");
        if (!currentSourceTerrain) {
            this.mapComponent().mapInstance.addSource("terrain", source);
        } else if (currentSourceTerrain && currentSourceTerrain.serialize().url !== source.url) {
            this.mapComponent().mapInstance.removeSource("terrain");
            this.mapComponent().mapInstance.addSource("terrain", source);
        }
        this.mapComponent().mapInstance.setTerrain({source: "terrain", exaggeration: 2});
    }
}
