﻿namespace IsraelHiking.Services.Layers {
    export interface IWikiPage {
        lat: number;
        lon: number;
        pageid: number;
        title: string;
    }

    export interface IWikiQuery {
        geosearch:  IWikiPage[];
    }

    export interface IWikiResponse {
        query: IWikiQuery;
    }

    export class WikiMarkersLayer extends ObjectWithMap implements L.ILayer {
        private $http: angular.IHttpService;
        private markers: L.LayerGroup<L.Marker>;
        private wikiMarkerIcon: L.Icon;
        private enabled: boolean;

        constructor($http: angular.IHttpService,
            mapService: MapService) {
            super(mapService);
            this.$http = $http;
            this.markers = L.layerGroup([] as L.Marker[]);
            this.enabled = false;
            this.wikiMarkerIcon = IconsService.createWikipediaIcon();
            this.map.on("moveend", () => {
                this.updateMarkers();
            });
        }

        public onAdd(map: L.Map): void {
            this.enabled = true;
            this.updateMarkers();
            map.addLayer(this.markers);
        }

        public onRemove(map: L.Map): void {
            map.removeLayer(this.markers);
            this.enabled = false;
        }

        private updateMarkers = (): void => {
            if (this.map.getZoom() < 13 || this.enabled === false) {
                this.markers.clearLayers();
                return;
            }
            let centerString = this.map.getCenter().lat + "|" + this.map.getCenter().lng;
            let url = `https://he.wikipedia.org/w/api.php?format=json&action=query&list=geosearch&gsradius=10000&gscoord=${centerString}&gslimit=500&callback=JSON_CALLBACK`;
            this.$http.jsonp(url).success((response: IWikiResponse) => {
                this.markers.clearLayers();
                for (let page of response.query.geosearch) {
                    let marker = L.marker(L.latLng(page.lat, page.lon), { clickable: true, draggable: false, icon: this.wikiMarkerIcon, title: page.title} as L.MarkerOptions);
                    let pageAddress = `https://he.wikipedia.org/?curid=${page.pageid}`;
                    marker.bindPopup(`<a href="${pageAddress}" target="_blank" dir="rtl">${page.title}</a>`);
                    this.markers.addLayer(marker);
                }
            });
        }

        public getAttribution(): string {
            return "<a href='//creativecommons.org/licenses/by-sa/3.0/'>© Wikipadia CCA-SA</a>";
        }
    }
}