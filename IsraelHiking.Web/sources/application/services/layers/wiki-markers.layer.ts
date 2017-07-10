import { Injectable, Injector, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { Jsonp } from "@angular/http";
import { MapService } from "../map.service";
import { ResourcesService } from "../resources.service";
import { IconsService } from "../icons.service";
import { BasePoiMarkerLayer } from "./base-poi-marker.layer";
import { WikiMarkerPopupComponent } from "../../components/markerpopup/wiki-marker-popup.component";
import "rxjs/add/operator/toPromise"
import * as Common from "../../common/IsraelHiking";
import * as _ from "lodash";
import "leaflet.markercluster";

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
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef) {
        super(mapService);
        this.minimalZoom = 13;
        this.markerIcon = IconsService.createWikipediaIcon();
        resources.languageChanged.subscribe(() => {
            this.markers.clearLayers();
            this.updateMarkers();
        });
    }

    protected getIconString() {
        return "fa icon-wikipedia-w";
    }

    protected updateMarkersInternal(): void {
        let centerString = this.mapService.map.getCenter().lat + "|" + this.mapService.map.getCenter().lng;
        let language = this.resources.currentLanguage.code.split("-")[0];
        let url = `https://${language}.wikipedia.org/w/api.php?format=json&action=query&list=geosearch&gsradius=10000&gscoord=${centerString}&gslimit=1000&callback=JSONP_CALLBACK`;
        this.jsonp.get(url).toPromise().then((response) => {
            // Sync lists
            let data = response.json() as IGeoSearchWikiResponse;
            this.markers.eachLayer(existingMarker => {
                let markerWithTitle = existingMarker as Common.IMarkerWithTitle;
                let geoSearchPage = _.find(data.query.geosearch, g => g.pageid.toString() === markerWithTitle.title);
                if (geoSearchPage == null) {
                    this.markers.removeLayer(existingMarker);
                } else {
                    data.query.geosearch.splice(data.query.geosearch.indexOf(geoSearchPage), 1);
                }
            });

            for (let currentPage of data.query.geosearch) {
                let marker = L.marker(L.latLng(currentPage.lat, currentPage.lon), { draggable: false, clickable: true, keyboard: false, icon: this.markerIcon, title: currentPage.title } as L.MarkerOptions) as Common.IMarkerWithTitle;
                marker.title = currentPage.pageid.toString();
                let markerPopupContainer = L.DomUtil.create("div");
                let pageAddress = `https://${language}.wikipedia.org/?curid=${currentPage.pageid}`;
                let factory = this.componentFactoryResolver.resolveComponentFactory(WikiMarkerPopupComponent);
                let componentRef = factory.create(this.injector, null, markerPopupContainer);
                componentRef.instance.address = pageAddress;
                componentRef.instance.title = currentPage.title;
                componentRef.instance.pageId = currentPage.pageid;
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

    public getAttribution(): string {
        return `<a href="//creativecommons.org/licenses/by-sa/3.0/">© Wikipadia CCA-SA</a>`;
    }
}