import { Injectable, Injector, ComponentFactoryResolver } from "@angular/core";
import { Http } from "@angular/http";
import * as _ from "lodash";

import { BasePoiMarkerLayer } from "./base-poi-marker.layer";
import { MapService } from "../map.service";
import { Urls } from "../../common/Urls";
import * as Common from "../../common/IsraelHiking";
import { PoiMarkerPopupComponent } from "../../components/markerpopup/poi-marker-popup.component";

export type FilterType = "Campsite" | "Spring, Pond" | "Viewpoint" | "Ruins" | "nature-reserve";

export interface PoiItem {
    id: string;
    type: FilterType;
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

export interface IFilter {
    type: FilterType,
    isSelected: boolean;
}

@Injectable()
export class PoiLayer extends BasePoiMarkerLayer {

    public filters: IFilter[];

    constructor(mapService: MapService,
        private http: Http,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver) {
        super(mapService);

        this.filters = [
            {
                type: "Campsite",
                isSelected: true,
            },
            {
                type: "Spring, Pond",
                isSelected: true,
            },
            {
                type: "Viewpoint",
                isSelected: true,
            },
            {
                type: "Ruins",
                isSelected: true,
            }
        ];
        this.updateMarkers();
    }

    protected getIconString(): string {
        return "fa icon-star";
    }

    protected getMinimalZoom(): number {
        return 9;
    }

    public toggleFilter(filter: IFilter) {
        filter.isSelected = !filter.isSelected;
        this.updateMarkers();
    }

    protected updateMarkersInternal(): void {
        let northEast = this.mapService.map.getBounds().getNorthEast();
        let southWest = this.mapService.map.getBounds().getSouthWest();
        this.http.get(Urls.poi,
            {
                params: {
                    northEast: northEast.lat + "," + northEast.lng,
                    southWest: southWest.lat + "," + southWest.lng,
                    filters: this.filters.filter(f => f.isSelected).map(f => f.type).join(",")
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
                let factory = this.componentFactoryResolver.resolveComponentFactory(PoiMarkerPopupComponent);
                let componentRef = factory.create(this.injector, null, markerPopupContainer);
                componentRef.instance.title = poi.title;
                componentRef.instance.id = poi.id;
                componentRef.instance.setMarker(marker);
                componentRef.instance.angularBinding(componentRef.hostView);
                marker.bindPopup(markerPopupContainer);
                this.markers.addLayer(marker);
            }
        }, () => {
            console.log("no points...?");
        });
    }




}