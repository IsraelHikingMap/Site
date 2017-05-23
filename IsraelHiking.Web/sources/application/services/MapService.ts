import { Injectable, Injector, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { LocalStorage } from "ngx-store";
import * as Common from "../common/IsraelHiking";
import "leaflet";

@Injectable()
export class MapService {
    public map: L.Map;

    @LocalStorage()
    private center: L.LatLng = L.latLng(31.773, 35.12);
    @LocalStorage()
    private zoom: number = 13;

    constructor(private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef) {
        this.map = L.map("map", {
            center: this.center,
            zoom: this.zoom,
            doubleClickZoom: false,
            zoomControl: false,
            keyboard: false,
        } as L.MapOptions);

        this.map.on("moveend", () => {
            this.center = this.map.getCenter();
            this.zoom = this.map.getZoom();
        });
    }

    public setMarkerTitle(marker: Common.IMarkerWithTitle, title: string, color: string = ""): string {
        marker.unbindTooltip();
        marker.title = title || "";
        if (!title) {
            return;
        }
        let controlDiv = L.DomUtil.create("div");
        for (let line of title.split("\n")) {
            let lineDiv = L.DomUtil.create("div", "", controlDiv);
            lineDiv.style.color = color;
            lineDiv.dir = this.getDirection(line);
            lineDiv.innerHTML = line;
        }
        marker.bindTooltip(controlDiv, { permanent: true, direction: "bottom" } as L.TooltipOptions);
    }

    public getDirection(line: string) {
        return (line.match(/^[^a-zA-Z]*[\u0591-\u05F4]/)) ? "rtl" : "ltr";
    }
}
