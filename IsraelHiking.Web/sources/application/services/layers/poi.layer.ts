import { Injectable, Injector, ComponentFactoryResolver } from "@angular/core";
import { Http } from "@angular/http";
import * as _ from "lodash";

import { BasePoiMarkerLayer } from "./base-poi-marker.layer";
import { MapService } from "../map.service";
import { PoiMarkerPopupComponent } from "../../components/markerpopup/poi-marker-popup.component";
import { IconsService } from "../icons.service";
import { Urls } from "../../common/Urls";
import * as Common from "../../common/IsraelHiking";

export interface PoiItem {
    id: string;
    type: string;
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
    type: string,
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
        this.filters = [];
        this.markerIcon = IconsService.createPoiIcon("icon-star", "orange");
        this.http.get(Urls.poiFilters).toPromise().then((response) => {
            // HM TODO: store filters state
            let filtersArray = response.json() as string[];
            for (let filter of filtersArray) {
                this.filters.push({
                    type: filter,
                    isSelected: true
                });
            }
            this.updateMarkers();
        });
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
                let features = response.json() as GeoJSON.Feature<GeoJSON.GeometryObject>[];
                this.markers.eachLayer(existingMarker => {
                    let markerWithTitle = existingMarker as Common.IMarkerWithTitle;
                    let geoSearchPage = _.find(features, p => p.properties.osm_id === markerWithTitle.identifier);
                    if (geoSearchPage == null) {
                        this.markers.removeLayer(existingMarker);
                    } else {
                        features.splice(features.indexOf(geoSearchPage), 1);
                    }
                });

                for (let feature of features) {
                    let properties = feature.properties as any;
                    // HM TODO: marker icons by type.
                    let latLng = L.latLng(properties.geolocation.lat, properties.geolocation.lon, properties.altitude);
                    let marker = L.marker(latLng, { draggable: false, clickable: true, icon: this.markerIcon, title: properties.name } as L.MarkerOptions) as Common.IMarkerWithTitle;
                    marker.title = properties.name;
                    marker.identifier = properties.osm_id;
                    let markerPopupContainer = L.DomUtil.create("div");
                    let factory = this.componentFactoryResolver.resolveComponentFactory(PoiMarkerPopupComponent);
                    let componentRef = factory.create(this.injector, null, markerPopupContainer);
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