import { Component, ViewEncapsulation, ElementRef, inject, viewChild, viewChildren } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { NgStyle, NgIf } from "@angular/common";
import { MapComponent, CustomControl } from "@maplibre/ngx-maplibre-gl";
import { setRTLTextPlugin, StyleSpecification, ScaleControl, Unit, RasterDEMSourceSpecification, PointLike, IControl, ControlPosition } from "maplibre-gl";
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
import { environment } from "environments/environment";

@Component({
    selector: "main-map",
    templateUrl: "./main-map.component.html",
    styleUrls: ["./main-map.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [NgProgressbar, NgProgressHttp, NgStyle, SidebarComponent, BackgroundTextComponent, MapComponent, LayersViewComponent, RoutesComponent, RecordedRouteComponent, TracesComponent, ZoomComponent, NgIf, LocationComponent, MainMenuComponent, SearchComponent, DrawingComponent, RouteStatisticsComponent, CenterMeComponent, IhmLinkComponent]
})
export class MainMapComponent {

    public mapComponent = viewChild(MapComponent);
    public topStartControls = viewChildren("topStartControl", { read: ElementRef });
    public topEndControls = viewChildren("topEndControl", { read: ElementRef });
    public bottomEndControls = viewChildren("bottomEndControl", { read: ElementRef });
    public bottomStartControls = viewChildren("bottomStartControl", { read: ElementRef });

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

    private addedControls: IControl[] = [];

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
        this.mapComponent().mapInstance.doubleClickZoom.enable();
        this.store.select((state: ApplicationState) => state.configuration.language.rtl).subscribe((rtl) => {
            const start = rtl ? "right" : "left";
            const end = rtl ? "left" : "right";
            for (const control of this.addedControls) {
                this.mapComponent().mapInstance.removeControl(control);
            }
            this.addedControls = [];
            for (const c of this.topStartControls()) {
                const control = new CustomControl(c.nativeElement);
                this.mapComponent().mapInstance.addControl(control,  "top-" + start as ControlPosition);
                this.addedControls.push(control);
            }
            for (const c of this.topEndControls()) {
                const control = new CustomControl(c.nativeElement);
                this.mapComponent().mapInstance.addControl(new CustomControl(c.nativeElement), "top-" + end as ControlPosition);
                this.addedControls.push(control);
            }
            const control = new ScaleControl({ unit: "meter" as Unit});
            this.mapComponent().mapInstance.addControl(control, "bottom-" + end as ControlPosition);
            this.addedControls.push(control);

            for (const c of this.bottomEndControls()) {
                const control = new CustomControl(c.nativeElement);
                this.mapComponent().mapInstance.addControl(control, "bottom-" + end as ControlPosition);
                this.addedControls.push(control);
            }
            for (const c of this.bottomStartControls()) {
                const control = new CustomControl(c.nativeElement);
                this.mapComponent().mapInstance.addControl(control, "bottom-" + start as ControlPosition);
                this.addedControls.push(control);
            }
        });

        this.mapComponent().mapInstance.on("click", (e) => {
            // This is used for the personal heatmap, assuming there's a layer there called "record_lines".
            const bbox = [
                [e.point.x - 5, e.point.y - 5],
                [e.point.x + 5, e.point.y + 5]
            ] as [PointLike, PointLike];
            const features = this.mapComponent().mapInstance.queryRenderedFeatures(bbox).filter(f => f.sourceLayer === "record_lines");
            if (features.length <= 0) { return; }
            this.dialog.open(TracesDialogComponent, { width: "480px", data: features.map(f => f.properties.trace_id) });
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
        // HM TODO: change this for global terrain
        let source: RasterDEMSourceSpecification = {
            type: "raster-dem",
            url: environment.baseTilesAddress + "/vector/data/TerrainRGB.json",
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
