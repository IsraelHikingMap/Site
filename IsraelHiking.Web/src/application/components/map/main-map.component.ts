import { Component, ViewEncapsulation, ElementRef, inject, viewChildren, DestroyRef } from "@angular/core";
import { NgStyle } from "@angular/common";
import { MapComponent, CustomControl } from "@maplibre/ngx-maplibre-gl";
import { type StyleSpecification, type Map, ScaleControl, Unit, IControl, ControlPosition, type RasterDEMSourceSpecification } from "maplibre-gl";
import { NgProgressbar } from "ngx-progressbar";
import { NgProgressHttp } from "ngx-progressbar/http";
import { Store } from "@ngxs/store";

import { SidebarComponent } from "../sidebar/sidebar.component";
import { LayersComponent } from "./layers.component";
import { RoutesComponent } from "./routes.component";
import { RecordedRouteComponent } from "./recorded-route.component";
import { ZoomComponent } from "../zoom.component";
import { LocationComponent } from "../location.component";
import { DrawingComponent } from "../drawing.component";
import { RouteStatisticsComponent } from "../route-statistics.component";
import { CenterMeComponent } from "../center-me.component";
import { MapeakLinkComponent } from "../mapeak-link.component";
import { PublicPoisComponent } from "./public-pois.component";
import { LayersButtonComponent } from "../layers-button.component";
import { OsmAttributionComponent } from "../osm-attribution.component";
import { MapeakTitleService } from "../../services/mapeak-title.service";
import { ResourcesService } from "../../services/resources.service";
import { MapService } from "../../services/map.service";
import { RunningContextService } from "../../services/running-context.service";
import { DefaultStyleService } from "../../services/default-style.service";
import type { ApplicationState, LocationState } from "../../models";

@Component({
    selector: "main-map",
    templateUrl: "./main-map.component.html",
    styleUrls: ["./main-map.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [NgProgressbar, NgProgressHttp, NgStyle, SidebarComponent, MapComponent, LayersComponent, PublicPoisComponent, RoutesComponent, RecordedRouteComponent, ZoomComponent, LocationComponent, DrawingComponent, RouteStatisticsComponent, CenterMeComponent, MapeakLinkComponent, LayersButtonComponent, OsmAttributionComponent]
})
export class MainMapComponent {

    public topStartControls = viewChildren("topStartControl", { read: ElementRef });
    public topEndControls = viewChildren("topEndControl", { read: ElementRef });
    public bottomEndControls = viewChildren("bottomEndControl", { read: ElementRef });
    public bottomStartControls = viewChildren("bottomStartControl", { read: ElementRef });

    public location: LocationState;
    public initialStyle: StyleSpecification;

    public readonly resources = inject(ResourcesService);

    private readonly titleService = inject(MapeakTitleService);
    private readonly mapService = inject(MapService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly store = inject(Store);
    private readonly destroyRef = inject(DestroyRef);

    private addedControls: IControl[] = [];
    private map: Map;
    private isTerrainOn: boolean = false;

    constructor() {
        this.location = this.store.selectSnapshot((s: ApplicationState) => s.locationState);
        this.initialStyle = this.defaultStyleService.getStyleWithPlaceholders();
        this.titleService.clear();
        this.destroyRef.onDestroy(() => {
            this.mapService.unsetMap();
            this.map = null;
        });
    }

    public mapLoaded(map: Map) {
        this.map = map;
        this.mapService.setMap(this.map);
        this.mapService.addArrowToMap(this.map);
        this.map.doubleClickZoom.enable();
        this.map._zoomLevelsToOverscale = 4;
        this.store.select((state: ApplicationState) => state.configuration.language.rtl).subscribe((rtl) => {
            const start = rtl ? "right" : "left";
            const end = rtl ? "left" : "right";
            for (const control of this.addedControls) {
                this.map.removeControl(control);
            }
            this.addedControls = [];
            for (const c of this.topStartControls()) {
                const control = new CustomControl(c.nativeElement);
                this.map.addControl(control, "top-" + start as ControlPosition);
                this.addedControls.push(control);
            }
            for (const c of this.topEndControls()) {
                const control = new CustomControl(c.nativeElement);
                this.map.addControl(new CustomControl(c.nativeElement), "top-" + end as ControlPosition);
                this.addedControls.push(control);
            }
            const control = new ScaleControl({ unit: "meter" as Unit });
            this.map.addControl(control, "bottom-" + end as ControlPosition);
            this.addedControls.push(control);

            for (const c of this.bottomEndControls()) {
                const control = new CustomControl(c.nativeElement);
                this.map.addControl(control, "bottom-" + end as ControlPosition);
                this.addedControls.push(control);
            }
            for (const c of this.bottomStartControls()) {
                const control = new CustomControl(c.nativeElement);
                this.map.addControl(control, "bottom-" + start as ControlPosition);
                this.addedControls.push(control);
            }
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
        if (this.runningContextService.isMobile || !this.map) {
            return;
        }
        const pitch = this.map.getPitch();
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
            this.map.setTerrain(null);
            return;
        }

        // Terrain is off and pitch is high, turning on.
        this.isTerrainOn = true;
        const source: RasterDEMSourceSpecification = {
            type: "raster-dem",
            tiles: ["slice://global.israelhikingmap.workers.dev/jaxa_terrarium0-11_v2/{z}/{x}/{y}.png"],
            minzoom: 7,
            maxzoom: 11,
            tileSize: 512,
            encoding: "terrarium"
        };
        const currentSourceTerrain = this.map.getSource("terrain");
        if (!currentSourceTerrain) {
            this.map.addSource("terrain", source);
        } else if (currentSourceTerrain && currentSourceTerrain.serialize().url !== source.url) {
            this.map.removeSource("terrain");
            this.map.addSource("terrain", source);
        }
        this.map.setTerrain({ source: "terrain", exaggeration: 2 });
    }
}
