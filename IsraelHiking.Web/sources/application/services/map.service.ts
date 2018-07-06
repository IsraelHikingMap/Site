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
    private zoom = 13;

    constructor(private readonly resources: ResourcesService) {
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

    public setMarkerTitle(marker: Common.IMarkerWithTitle, data: Common.MarkerData, color: string = "") {
        marker.unbindTooltip();
        let title = data.title || "";
        marker.title = title;
        let hasImage = _.some(data.urls, u => u.mimeType.startsWith("image"));
        if (!title && !hasImage) {
            return;
        }
        let controlDiv = L.DomUtil.create("div");
        let lines = title.split("\n");
        let displayLine = lines[0];
        if (lines.length > 1 || data.description) {
            displayLine += "...";
        }
        let element = hasImage
            ? L.DomUtil.create("i", "fa icon-camera", controlDiv) :
            L.DomUtil.create("div", "", controlDiv);
        element.style.color = color;
        element.dir = this.resources.getDirection(displayLine);
        element.innerHTML = ` ${displayLine}`;
        marker.bindTooltip(controlDiv, { permanent: true, direction: "bottom", interactive: true } as L.TooltipOptions);
    }

    public addAreaToReadOnlyLayer(readOnlyLayer: L.LayerGroup, routesData: Common.RouteData[]) {
        readOnlyLayer.clearLayers();
        let groupedLatLngs = this.getGroupedLatLngForAntPath(routesData[0].segments);
        readOnlyLayer.addLayer(L.polygon(groupedLatLngs));
    }

    public updateReadOnlyLayer = (readOnlyLayer: L.LayerGroup, routesData: Common.RouteData[]) => {
        readOnlyLayer.clearLayers();

        if (routesData == null || routesData.length === 0) {
            return;
        }
        for (let routeData of routesData) {
            if (routeData.segments.length === 0) {
                continue;
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
        let firstRoute = _.first(routesData);
        if (firstRoute.segments.length === 0) {
            return;
        }
        let firstPoint = _.first(_.first(firstRoute.segments).latlngs);

        readOnlyLayer.addLayer(L.marker(firstPoint,
            {
                opacity: 1,
                draggable: false,
                clickable: false,
                icon: IconsService.createRoundIcon("green")
            }));
        let lastPoint = _.last(_.last(_.last(routesData).segments).latlngs);
        readOnlyLayer.addLayer(L.marker(lastPoint,
            {
                opacity: 1,
                draggable: false,
                clickable: false,
                icon: IconsService.createRoundIcon("red")
            }));
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
                    let fullLatLng = L.latLng(latlng.lat, latlng.lng, latlng.alt);
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
