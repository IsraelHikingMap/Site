import { Injectable } from "@angular/core";
import { LocalStorage } from "ngx-store";
import * as L from "leaflet";
import * as _ from "lodash";

import { ResourcesService } from "./resources.service";
import * as Common from "../common/IsraelHiking";
import {IconsService} from "./icons.service";


@Injectable()
export class MapService {
    public map: L.Map;

    @LocalStorage()
    private center = L.latLng(31.773, 35.12);
    @LocalStorage()
    private zoom: number = 13;

    constructor(private resources: ResourcesService) {
        this.map = L.map("map", {
            center: this.center,
            zoom: this.zoom,
            doubleClickZoom: false,
            zoomControl: false,
        } as L.MapOptions);
        
        this.map.on("moveend", () => {
            this.center = this.map.getCenter();
            this.zoom = this.map.getZoom();
        });
    }

    public setMarkerTitle(marker: Common.IMarkerWithTitle, title: string, color: string = "") {
        marker.unbindTooltip();
        marker.title = title || "";
        if (!title) {
            return;
        }
        let controlDiv = L.DomUtil.create("div");
        for (let line of title.split("\n")) {
            let lineDiv = L.DomUtil.create("div", "", controlDiv);
            lineDiv.style.color = color;
            lineDiv.dir = this.resources.getDirection(line);
            lineDiv.innerHTML = line;
        }
        marker.bindTooltip(controlDiv, { permanent: true, direction: "bottom" } as L.TooltipOptions);
    }

    public updateReadOnlyLayer = (readOnlyLayer: L.LayerGroup, routeData: Common.RouteData) => {
        readOnlyLayer.clearLayers();

        if (routeData == null || routeData.segments.length === 0) {
            return;
        }
        for (let segment of routeData.segments) {
            if (segment.latlngs.length < 2 ||
                (segment.latlngs.length === 2 && segment.latlngs[0].equals(segment.latlngs[1]))) {
                continue;
            }
            let polyLine = L.polyline(segment.latlngs,
                {
                    opacity: 1,
                    color: "Blue",
                    weight: 3,
                    dashArray: "30 10",
                    className: "segment-readonly-indicator"
                } as L.PathOptions);
            readOnlyLayer.addLayer(polyLine);
            readOnlyLayer.addLayer(L.marker(segment.latlngs[0],
                {
                    opacity: 1,
                    draggable: false,
                    clickable: false,
                    icon: IconsService.createRoundIcon("green")
                }));
            readOnlyLayer.addLayer(L.marker(_.last(segment.latlngs),
                {
                    opacity: 1,
                    draggable: false,
                    clickable: false,
                    icon: IconsService.createRoundIcon("red")
                }));
        }

        for (let markerData of routeData.markers) {
            let marker = L.marker(markerData.latlng,
                {
                    draggable: false,
                    clickable: false,
                    icon: IconsService.createPoiDefaultMarkerIcon("blue")
                } as L.MarkerOptions);
            marker.bindTooltip(markerData.title, { permanent: true, direction: "bottom" } as L.TooltipOptions);
            readOnlyLayer.addLayer(marker);
        }
    }
}
