import { Component, ViewEncapsulation, ElementRef, inject, viewChild, viewChildren } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { NgStyle, NgIf } from "@angular/common";
import { MapComponent, CustomControl } from "@maplibre/ngx-maplibre-gl";
import { setRTLTextPlugin, StyleSpecification, ScaleControl, Unit, PointLike, IControl, ControlPosition } from "maplibre-gl";
import { NgProgressbar } from "ngx-progressbar";
import { NgProgressHttp } from "ngx-progressbar/http";
import { Store } from "@ngxs/store";

import { TracesDialogComponent } from "../dialogs/traces-dialog.component";
import { SidebarComponent } from "../sidebar/sidebar.component";
import { BackgroundTextComponent } from "../background-text.component";
import { LayersComponent } from "./layers.component";
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
import { MapeakLinkComponent } from "../mapeak-link.component";
import { PublicPoisComponent } from "./public-pois.component";
import { MapeakTitleService } from "../../services/mapeak-title.service";
import { ResourcesService } from "../../services/resources.service";
import { MapService } from "../../services/map.service";
import { RunningContextService } from "../../services/running-context.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { SetLocationAction } from "../../reducers/location.reducer";
import type { ApplicationState, LocationState } from "../../models";

@Component({
    selector: "main-map",
    templateUrl: "./main-map.component.html",
    styleUrls: ["./main-map.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [NgProgressbar, NgProgressHttp, NgStyle, SidebarComponent, BackgroundTextComponent, MapComponent, LayersComponent, PublicPoisComponent, RoutesComponent, RecordedRouteComponent, TracesComponent, ZoomComponent, NgIf, LocationComponent, MainMenuComponent, SearchComponent, DrawingComponent, RouteStatisticsComponent, CenterMeComponent, MapeakLinkComponent]
})
export class MainMapComponent {

    public mapComponent = viewChild(MapComponent);
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
    private readonly dialog = inject(MatDialog);
    private readonly store = inject(Store);

    private addedControls: IControl[] = [];

    constructor() {
        this.location = this.store.selectSnapshot((s: ApplicationState) => s.locationState);
        this.initialStyle = this.defaultStyleService.getStyleWithPlaceholders();
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

        // HM TODO: remove this once it is no longer experimental
        this.mapComponent().mapInstance._overzoomingWithGeojsonVt = true;
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
}
