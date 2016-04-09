module IsraelHiking.Services.Drawing {
    interface IWikiPage {
        lat: number;
        lon: number;
        pageid: number;
        title: string;
    }
    interface IWikiQuery {
        geosearch:  IWikiPage[];
    }
    interface IWikiResponse {
        query: IWikiQuery;
    }

    export class WikiMarkersLayer extends ObjectWithMap implements L.ILayer {
        private $http: angular.IHttpService;
        private markers: L.LayerGroup<L.Marker>;
        private wikiMarkerIcon: L.Icon;

        constructor($http: angular.IHttpService,
            mapService: MapService) {
            super(mapService);
            this.$http = $http;
            this.markers = L.layerGroup([]);
            this.wikiMarkerIcon = L.icon({
                iconSize: L.point(50, 50),
                iconAnchor: L.point(25, 50),
                popupAnchor: L.point(0, -48),
                iconUrl: "/content/images/marker-icon-wiki.png"
            } as L.IconOptions);
            this.map.on("moveend", () => {
                this.updateMarkers();
            });
        }

        public onAdd(map: L.Map): void {
            this.updateMarkers();
            map.addLayer(this.markers);
        }

        public onRemove(map: L.Map): void {
            map.removeLayer(this.markers);
        }

        private updateMarkers = (): void => {
            if (this.map.getZoom() < 13) {
                this.markers.clearLayers();
                return;
            }
            let centerString = this.map.getCenter().lat + "|" + this.map.getCenter().lng;
            let url = `https://he.wikipedia.org/w/api.php?format=json&action=query&list=geosearch&gsradius=10000&gscoord=${centerString}&gslimit=500&callback=JSON_CALLBACK`;
            this.$http({
                url: url,
                method: "jsonp"
            }).success((response: IWikiResponse) => {
                this.markers.clearLayers();
                for (let page of response.query.geosearch) {
                    let marker = L.marker(L.latLng(page.lat, page.lon), { clickable: true, draggable: false, icon: this.wikiMarkerIcon, title: page.title} as L.MarkerOptions);
                    let pageAddress = `https://he.wikipedia.org/?curid=${page.pageid}`;
                    marker.bindPopup(`<a href="${pageAddress}" target="_blank" dir="rtl">${page.title}</a>`);
                    this.markers.addLayer(marker);
                }
            });
        }
    }
}