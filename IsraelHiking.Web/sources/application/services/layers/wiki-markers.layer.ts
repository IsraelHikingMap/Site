import { Injectable, Injector, ComponentFactoryResolver } from "@angular/core";
import { Jsonp } from "@angular/http";
import * as L from "leaflet";
import * as _ from "lodash";
import "leaflet.markercluster";

import { MapService } from "../map.service";
import { ResourcesService } from "../resources.service";
import { IconsService } from "../icons.service";
import { BasePoiMarkerLayer } from "./base-poi-marker.layer";
import { WikiMarkerPopupComponent } from "../../components/markerpopup/wiki-marker-popup.component";
import * as Common from "../../common/IsraelHiking";

export interface IGeoSearchWikiPage {
    lat: number;
    lon: number;
    pageid: number;
    title: string;
}

export interface IGeoSearchWikiQuery {
    geosearch: IGeoSearchWikiPage[];
}

export interface IGeoSearchWikiResponse {
    query: IGeoSearchWikiQuery;
}

@Injectable()
export class WikiMarkersLayer extends BasePoiMarkerLayer {

    constructor(mapService: MapService,
        private jsonp: Jsonp,
        private resources: ResourcesService,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver) {
        super(mapService);
        this.markerIcon = IconsService.createWikipediaIcon();
        resources.languageChanged.subscribe(() => {
            this.markers.clearLayers();
            this.updateMarkers();
        });
    }

    protected getIconString() {
        return "fa icon-wikipedia-w";
    }

    protected getMinimalZoom(): number {
         return 13;
    }

    protected updateMarkersInternal(): void {
        let centerString = this.mapService.map.getCenter().lat + "|" + this.mapService.map.getCenter().lng;
        let language = this.resources.getCurrentLanguageCodeSimplified();
        let url = `https://${language}.wikipedia.org/w/api.php?format=json&action=query&list=geosearch&gsradius=10000&gscoord=${centerString}&gslimit=1000&callback=JSONP_CALLBACK`;
        this.jsonp.get(url).toPromise().then((response) => {
            // Sync lists
            let data = response.json() as IGeoSearchWikiResponse;
            this.markers.eachLayer(existingMarker => {
                let markerWithTitle = existingMarker as Common.IMarkerWithTitle;
                let geoSearchPage = _.find(data.query.geosearch, g => g.pageid.toString() === markerWithTitle.identifier);
                if (geoSearchPage == null) {
                    this.markers.removeLayer(existingMarker);
                } else {
                    data.query.geosearch.splice(data.query.geosearch.indexOf(geoSearchPage), 1);
                }
            });

            for (let currentPage of data.query.geosearch) {
                let marker = L.marker(L.latLng(currentPage.lat, currentPage.lon), { draggable: false, clickable: true, icon: this.markerIcon, title: currentPage.title } as L.MarkerOptions) as Common.IMarkerWithTitle;
                marker.title = currentPage.title;
                marker.identifier = currentPage.pageid.toString();
                let markerPopupContainer = L.DomUtil.create("div");
                let pageAddress = `https://${language}.wikipedia.org/?curid=${currentPage.pageid}`;
                let factory = this.componentFactoryResolver.resolveComponentFactory(WikiMarkerPopupComponent);
                let componentRef = factory.create(this.injector, null, markerPopupContainer);
                componentRef.instance.address = pageAddress;
                componentRef.instance.title = currentPage.title;
                componentRef.instance.pageId = currentPage.pageid;
                componentRef.instance.setMarker(marker);
                componentRef.instance.angularBinding(componentRef.hostView);
                marker.bindPopup(markerPopupContainer);
                this.markers.addLayer(marker);
            }
        });
    }

    public getAttribution(): string {
        return `<a href="//creativecommons.org/licenses/by-sa/3.0/">© Wikipadia CCA-SA</a>`;
    }
}