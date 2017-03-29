namespace IsraelHiking.Services.Layers {
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
            let url = `https://${lang}.wikipedia.org/w/api.php?format=json&action=query&list=geosearch&gsradius=10000&gscoord=${centerString}&gslimit=1000&callback=JSON_CALLBACK`;
            this.$http.jsonp(url).success((response: IGeoSearchWikiResponse) => {
                // Sync lists
                this.markers.eachLayer(l => {
                    if (l instanceof L.Marker) {
                        let markerWithTitle = l as Common.IMarkerWithTitle;
                        let geoSearchPage = _.find(response.query.geosearch, g => g.pageid.toString() === markerWithTitle.title);
                        if (geoSearchPage == null) {
                            this.markers.removeLayer(l);
                        } else {
                            response.query.geosearch.splice(response.query.geosearch.indexOf(geoSearchPage), 1);
                        }
                    }
                });

                for (let currentPage of response.query.geosearch) {

                    let marker = L.marker(L.latLng(currentPage.lat, currentPage.lon), { clickable: true, draggable: false, icon: this.wikiMarkerIcon, title: currentPage.title } as L.MarkerOptions) as Common.IMarkerWithTitle;
                    marker.title = currentPage.pageid.toString();

                    let pageAddress = `https://${lang}.wikipedia.org/?curid=${currentPage.pageid}`;
                    let header = `<h4 ${dir} class="text-center"><a href="${pageAddress}" target="_blank">${currentPage.title}</a></h4>`;
                    marker.bindPopup(header);
                    marker.on("popupopen", () => {
                        this.popupOpen = true;
                        var popup = marker.getPopup();
                        var detailsUrl = `https://${lang}.wikipedia.org/w/api.php?format=json&action=query&pageids=${currentPage.pageid}&prop=extracts|pageimages&explaintext=true&exintro=true&exsentences=1&callback=JSON_CALLBACK`;
                        this.$http.jsonp(detailsUrl).success((detailsResponse: IWikiResponse) => {
                            let currentDetailedPage = detailsResponse.query.pages[currentPage.pageid];
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