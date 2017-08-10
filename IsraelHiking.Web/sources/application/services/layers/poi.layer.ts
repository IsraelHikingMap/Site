import { Injector, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";
import * as _ from "lodash";

import { BasePoiMarkerLayer } from "./base-poi-marker.layer";
import { MapService } from "../map.service";
import { Urls } from "../../common/Urls";
import * as Common from "../../common/IsraelHiking";
import { DrawingPoiMarkerPopupComponent } from "../../components/markerpopup/drawing-poi-marker-popup.component";

export type Filter = "Camping" | "spring" | "viewpoint" | "ruins" | "nature-reserve";

export interface PoiItem {
    id: string;
    type: Filter;
    title: string;
    location: L.LatLng;
}

export interface PoiItemExtended extends PoiItem {
    source: string;
    imageUrl: string;
    description: string;
    rating: number;
    sourceId: string;
    address: string;
}

export class PoiLayer extends BasePoiMarkerLayer {

    public fileters: Filter[];
    public selectedFilters: Filter[];

    constructor(mapService: MapService,
        private http: Http,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef) {
        super(mapService);

    }

    getIconString(): string {
        return "fa icon-star";
    }

    getMinimalZoom(): number {
        return 9;
    }

    updateMarkersInternal(): void {
        let northEast = this.mapService.map.getBounds().getNorthEast();
        let southWest = this.mapService.map.getBounds().getSouthWest();
        this.http.get(Urls.poi,
            {
                params: {
                    northEast: northEast.lat + "," + northEast.lng,
                    southWest: southWest.lat + "," + southWest.lng,
                    filters: this.selectedFilters.join(",")
                }
            }).toPromise().then((response) => {
            let pointsOfInterest = response.json() as PoiItem[];
            this.markers.eachLayer(existingMarker => {
                let markerWithTitle = existingMarker as Common.IMarkerWithTitle;
                let geoSearchPage = _.find(pointsOfInterest, p => p.id === markerWithTitle.title);
                if (geoSearchPage == null) {
                    this.markers.removeLayer(existingMarker);
                } else {
                    pointsOfInterest.splice(pointsOfInterest.indexOf(geoSearchPage), 1);
                }
            });

            for (let poi of pointsOfInterest) {
                let marker = L.marker(L.latLng(poi.location.lat, poi.location.lng), { draggable: false, clickable: true, icon: this.markerIcon, title: poi.title } as L.MarkerOptions) as Common.IMarkerWithTitle;
                marker.title = poi.id;
                let markerPopupContainer = L.DomUtil.create("div");
                let factory = this.componentFactoryResolver.resolveComponentFactory(DrawingPoiMarkerPopupComponent);
                let componentRef = factory.create(this.injector, null, markerPopupContainer);
                componentRef.instance.title = poi.title;
                //componentRef.instance.id = poi.id;
                componentRef.instance.setMarker(marker);
                marker.bindPopup(markerPopupContainer);
                marker.on("popupopen", () => {
                    this.applicationRef.attachView(componentRef.hostView);
                });
                marker.on("popupclose", () => {
                    this.applicationRef.detachView(componentRef.hostView);
                });
                this.markers.addLayer(marker);
            }
        });
    }




}