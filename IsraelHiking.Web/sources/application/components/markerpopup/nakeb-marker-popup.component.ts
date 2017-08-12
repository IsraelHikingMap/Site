import { Component, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";
import * as _ from "lodash";

import { ResourcesService } from "../../services/resources.service";
import { MapService } from "../../services/map.service";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { ElevationProvider } from "../../services/elevation.provider";
import * as Common from "../../common/IsraelHiking";



export interface NakebItemExtended extends NakebItem {
    latlngs: L.LatLng[];
    markers: { latlng: L.LatLng, title: string }[];
}

export interface NakebItem {
    start: L.LatLng;
    length: number;
    picture: string;
    title: string;
    link: string;
    attributes: string[];
    id: number;
    prolog: string;
}

@Component({
    selector: "nakeb-marker-popup",
    templateUrl: "./nakeb-marker-popup.component.html"
})
export class NakebMarkerPopupComponent extends BaseMarkerPopupComponent {
    public address: string;
    public extract: string;
    public thumbnail: string;
    public length: number;
    public attributes: string;
    public pageId: number;

    private routeData: Common.RouteData;

    constructor(resources: ResourcesService,
        http: Http,
        applicationRef: ApplicationRef,
        elevationProvider: ElevationProvider,
        private mapService: MapService,
        private routesService: RoutesService) {
        super(resources, http, applicationRef, elevationProvider);

        this.routeData = null;
        this.address = "";
    }

    // Should be defined by the main nakeb layer to faciliatate for single route
    public selectRoute = (routeData: Common.RouteData) => { };
    public clearSelectedRoute = () => {};
    
    public setMarker(marker: Common.IMarkerWithTitle) {
        this.marker = marker;
        this.marker.on("popupopen", () => {
            if (this.routeData != null) {
                this.selectRoute(this.routeData);
                return;
            }
            let popup = this.marker.getPopup();
            let url = `https://www.nakeb.co.il/api/hikes/${this.pageId}`;
            this.http.get(url).toPromise().then((detailsResponse) => {
                let nakebItem = detailsResponse.json() as NakebItemExtended;
                this.extract = nakebItem.prolog;
                this.title = nakebItem.title;
                this.address = nakebItem.link;
                this.length = nakebItem.length;
                this.thumbnail = nakebItem.picture;
                this.attributes = nakebItem.attributes.join(", ");
                popup.update();

                this.routeData = this.getRouteData(nakebItem);
                this.selectRoute(this.routeData);
                
            });
        });
    }

    public convertToRoute() {
        this.routesService.setData([this.routeData]);
        this.clearSelectedRoute();
    }
    
    private getRouteData(item: NakebItemExtended): Common.RouteData {
        let routeData = {
            name: item.title,
            description: item.prolog,
            segments: [],
            markers: [],
        } as Common.RouteData;
        let latLngs = [] as L.LatLng[];
        for (let latLng of item.latlngs) {
            latLngs.push(L.latLng(latLng.lat, latLng.lng, latLng.alt || 0));
        }
        this.elevationProvider.updateHeights(latLngs);
        routeData.segments.push({ latlngs: [latLngs[0], latLngs[0]], routePoint: latLngs[0] } as Common.RouteSegmentData);
        routeData.segments.push({ latlngs: latLngs, routePoint: _.last(latLngs) } as Common.RouteSegmentData);

        for (let nakebMarker of item.markers) {
            routeData.markers.push({
                title: nakebMarker.title,
                latlng: L.latLng(nakebMarker.latlng.lat, nakebMarker.latlng.lng)
            } as Common.MarkerData);
        }
        return routeData;
    }
}