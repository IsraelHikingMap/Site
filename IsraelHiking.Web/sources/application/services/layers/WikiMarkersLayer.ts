import { Injectable, Injector, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { Jsonp } from "@angular/http";
import { MapService } from "../MapService";
import { ResourcesService } from "../ResourcesService";
import { IconsService } from "../IconsService";
import { WikiMarkerPopupComponent } from "../../components/markerpopup/WikiMarkerPopupComponent";
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
export class WikiMarkersLayer extends L.Layer {
    private markers: L.MarkerClusterGroup;
    private wikiMarkerIcon: L.DivIcon;
    private enabled: boolean;

    constructor(private jsonp: Jsonp,
        private mapService: MapService,
        private resources: ResourcesService,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef) {
        super();
        this.resources = resources;
        this.markers = L.markerClusterGroup();
        this.enabled = false;
        this.wikiMarkerIcon = IconsService.createWikipediaIcon();
        resources.languageChanged.subscribe(() => {
            this.markers.clearLayers();
            this.updateMarkers();
        });
        this.mapService.map.on("moveend", () => {
            this.updateMarkers();
        });
    }

    public onAdd(map: L.Map): this {
        this.enabled = true;
        this.updateMarkers();
        map.addLayer(this.markers);
        return this;
    }

    public onRemove(map: L.Map): this {
        map.removeLayer(this.markers);
        this.enabled = false;
        return this;
    }

    private updateMarkers = (): void => {
        if (this.mapService.map.getZoom() < 13 || this.enabled === false) {
            this.markers.clearLayers();
            return;
        }
        let centerString = this.mapService.map.getCenter().lat + "|" + this.mapService.map.getCenter().lng;
        let language = this.resources.currentLanguage.code.split("-")[0];
        let url = `https://${language}.wikipedia.org/w/api.php?format=json&action=query&list=geosearch&gsradius=10000&gscoord=${centerString}&gslimit=1000&callback=JSONP_CALLBACK`;
        this.jsonp.get(url).toPromise().then((response) => {
            // Sync lists
            let data = response.json() as IGeoSearchWikiResponse;
            this.markers.eachLayer(l => {
                if (l instanceof L.Marker) {
                    let markerWithTitle = l as Common.IMarkerWithTitle;
                    let geoSearchPage = _.find(data.query.geosearch, g => g.pageid.toString() === markerWithTitle.title);
                    if (geoSearchPage == null) {
                        this.markers.removeLayer(l);
                    } else {
                        data.query.geosearch.splice(data.query.geosearch.indexOf(geoSearchPage), 1);
                    }
                }
            });

            for (let currentPage of data.query.geosearch) {

                let marker = L.marker(L.latLng(currentPage.lat, currentPage.lon), { draggable: false, clickable: true, keyboard: false, icon: this.wikiMarkerIcon, title: currentPage.title } as L.MarkerOptions) as Common.IMarkerWithTitle;
                marker.title = currentPage.pageid.toString();
                let markerPopupContainer = L.DomUtil.create("div");
                let pageAddress = `https://${language}.wikipedia.org/?curid=${currentPage.pageid}`;
                let factory = this.componentFactoryResolver.resolveComponentFactory(WikiMarkerPopupComponent);
                let componentRef = factory.create(this.injector, null, markerPopupContainer);
                componentRef.instance.address = pageAddress;
                componentRef.instance.title = currentPage.title;
                componentRef.instance.pageId = currentPage.pageid;
                componentRef.instance.setMarker(marker);
                this.applicationRef.attachView(componentRef.hostView);
                marker.bindPopup(markerPopupContainer);
                this.markers.addLayer(marker);
            }
        });
    }

    public getAttribution(): string {
        return "<a href='//creativecommons.org/licenses/by-sa/3.0/'>© Wikipadia CCA-SA</a>";
    }
}