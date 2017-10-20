import { Injectable } from "@angular/core";
import { LocalStorage } from "ngx-store";
import * as L from "leaflet";
import * as _ from "lodash";

import { ResourcesService } from "./resources.service";
import { IconsService } from "./icons.service";
import * as Common from "../common/IsraelHiking";


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
        let groupedLatLngs = this.getGroupedLatLngForAntPath(routeData.segments);
        for (let group of groupedLatLngs) {
            let polyLine = L.polyline(group,
                {
                    opacity: 1,
                    color: "Blue",
                    weight: 3,
                    dashArray: "30 10",
                    className: "segment-readonly-indicator"
                } as L.PathOptions);
            readOnlyLayer.addLayer(polyLine);
        }

        readOnlyLayer.addLayer(L.marker(_.first(_.first(routeData.segments).latlngs),
            {
                opacity: 1,
                draggable: false,
                clickable: false,
                icon: IconsService.createRoundIcon("green")
            }));
        readOnlyLayer.addLayer(L.marker(_.last(_.last(routeData.segments).latlngs),
            {
                opacity: 1,
                draggable: false,
                clickable: false,
                icon: IconsService.createRoundIcon("red")
            }));

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

    /**
     * Gourp as many segment coordinates in order for the ant path to look smoother
     * @param segments - the segments to group
     * @returns {} - an array of array of coordinates
     */
    public getGroupedLatLngForAntPath(segments: Common.RouteSegmentData[]): L.LatLng[][] {
        let groupedLatLngs = [] as L.LatLng[][]; 
        let currentGroup = [] as L.LatLng[];
        for (let segment of segments) {
            if (currentGroup.length === 0) {
                currentGroup = segment.latlngs;
                continue;
            }
            if (_.last(currentGroup).equals(_.first(segment.latlngs))) {
                currentGroup = currentGroup.concat(_.drop(segment.latlngs, 1));
                continue;
            }
            groupedLatLngs.push(currentGroup);
            currentGroup = segment.latlngs;
        }
        groupedLatLngs.push(currentGroup);
        return groupedLatLngs;
    }

    public routesJsonToRoutesObject(routes: Common.RouteData[]) {
        for (let route of routes) {
            for (let segment of route.segments) {
                let latlngs = [] as L.LatLng[];
                for (let latlng of segment.latlngs) {
                    var fullLatLng = L.latLng(latlng.lat, latlng.lng, latlng.alt);
                    latlngs.push(fullLatLng);
                }
                segment.latlngs = latlngs;
                segment.routePoint = L.latLng(segment.routePoint.lat, segment.routePoint.lng, segment.routePoint.alt);
            }
            route.markers = route.markers || [];
            for (let marker of route.markers) {
                marker.latlng = L.latLng(marker.latlng.lat, marker.latlng.lng, marker.latlng.alt);
            }
        }
    }
}
