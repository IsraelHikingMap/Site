namespace IsraelHiking.Services.Layers {
    export interface IWikiPage {
        coordinates: {
            lat: number;
            lon: number;
        }[];
        thumbnail: {
            height: number;
            width: number;
            source: string;
            original: string;
        }
        pageid: number;
        title: string;
        extract: string;
    }

    export interface IWikiQuery {
        pages: { [index: number]: IWikiPage };
    }

    export interface IWikiResponse {
        query: IWikiQuery;
    }

    export class WikiMarkersLayer extends ObjectWithMap implements L.ILayer {
        private $http: angular.IHttpService;
        private resourcesService: ResourcesService;
        private markers: L.MarkerClusterGroup;
        private wikiMarkerIcon: L.Icon;
        private enabled: boolean;
        private popupOpen: boolean;

        constructor($http: angular.IHttpService,
            $rootScope: angular.IRootScopeService,
            mapService: MapService,
            resourcesService: ResourcesService) {
            super(mapService);
            this.$http = $http;
            this.resourcesService = resourcesService;
            this.markers = new L.MarkerClusterGroup();
            this.enabled = false;
            this.popupOpen = false;
            this.wikiMarkerIcon = IconsService.createWikipediaIcon();
            $rootScope.$watch(() => resourcesService.currentLanguage, () => {
                this.popupOpen = false;
                this.updateMarkers();
            });
            this.map.on("moveend", () => {
                if (!this.popupOpen) {
                    this.updateMarkers();
                }
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
            let lang = this.resourcesService.currentLanguage.code.split("-")[0];
            let dir = "";
            let textAlign = "text-left";
            if (this.resourcesService.currentLanguage.rtl) {
                dir = 'dir="rtl"';
                textAlign = "text-right";    
            }
            let url = `https://${lang}.wikipedia.org/w/api.php?format=json&action=query&prop=coordinates&generator=geosearch&ggsradius=10000&ggscoord=${centerString}&ggslimit=500&callback=JSON_CALLBACK`;
            this.$http.jsonp(url).success((response: IWikiResponse) => {
                this.markers.clearLayers();
                for (let pageKey in response.query.pages) {
                    let currentPage = response.query.pages[pageKey];
                    if (!currentPage.coordinates || currentPage.coordinates.length < 1) {
                        continue;
                    }
                    let coordinates = currentPage.coordinates[0];
                    let marker = L.marker(L.latLng(coordinates.lat, coordinates.lon), { clickable: true, draggable: false, icon: this.wikiMarkerIcon, title: currentPage.title } as L.MarkerOptions);

                    let pageAddress = `https://${lang}.wikipedia.org/?curid=${currentPage.pageid}`;
                    let header = `<h4 ${dir} class="text-center"><a href="${pageAddress}" target="_blank">${currentPage.title}</a></h4>`;
                    marker.bindPopup(header);
                    marker.on("popupopen", () => {
                        this.popupOpen = true;
                        var popup = marker.getPopup();
                        var detailsUrl = `https://${lang}.wikipedia.org/w/api.php?format=json&action=query&pageids=${currentPage.pageid}&prop=extracts|pageimages&explaintext=true&exintro=true&exsentences=1&callback=JSON_CALLBACK`;
                        this.$http.jsonp(detailsUrl).success((detailsResponse: IWikiResponse) => {
                            let currentDetailedPage = detailsResponse.query.pages[pageKey];
                            let imageHtml = "";
                            if (currentDetailedPage.thumbnail) {
                                imageHtml = `<img src="${currentDetailedPage.thumbnail.source}" class="img-responsive" style="max-width:100% !important" />`;
                            }
                            var content = header + `<div class="row">` +
                                `  <div class="col-xs-9 ${textAlign}" ${dir}>${currentDetailedPage.extract || ""}</div>` +
                                `  <div class="col-xs-3">${imageHtml}</div>` +
                                `</div>`;
                            popup.setContent(content);
                            popup.update();
                        });
                    });
                    marker.on("popupclose", () => { this.popupOpen = false; });
                    this.markers.addLayer(marker);
                }
            });
        }

        public getAttribution(): string {
            return "<a href='//creativecommons.org/licenses/by-sa/3.0/'>© Wikipadia CCA-SA</a>";
        }
    }
}