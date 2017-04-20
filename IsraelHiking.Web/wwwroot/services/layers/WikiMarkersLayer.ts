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

    export class WikiMarkersLayer extends L.Layer {
        private $http: angular.IHttpService;
        private resourcesService: ResourcesService;
        private markers: L.MarkerClusterGroup;
        private wikiMarkerIcon: L.DivIcon;
        private enabled: boolean;
        private map: L.Map;

        constructor($http: angular.IHttpService,
            $rootScope: angular.IRootScopeService,
            mapService: MapService,
            resourcesService: ResourcesService) {
            super();
            this.map = mapService.map;
            this.$http = $http;
            this.resourcesService = resourcesService;
            this.markers = L.markerClusterGroup();
            this.enabled = false;
            this.wikiMarkerIcon = IconsService.createWikipediaIcon();
            $rootScope.$watch(() => resourcesService.currentLanguage, () => {
                this.updateMarkers();
            });
            this.map.on("moveend", () => {
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
            if (this.map.getZoom() < 13 || this.enabled === false) {
                this.markers.clearLayers();
                return;
            }
            let centerString = this.map.getCenter().lat + "|" + this.map.getCenter().lng;
            let lang = this.resourcesService.currentLanguage.code.split("-")[0];
            let dir = "";
            let textAlign = "text-left";
            if (this.resourcesService.currentLanguage.rtl) {
                dir = "rtl";
                textAlign = "text-right";
            }
            let url = `https://${lang}.wikipedia.org/w/api.php?format=json&action=query&list=geosearch&gsradius=10000&gscoord=${centerString}&gslimit=1000&callback=JSON_CALLBACK`;
            this.$http.jsonp(url).then((response: { data: IGeoSearchWikiResponse }) => {
                // Sync lists
                this.markers.eachLayer(l => {
                    if (l instanceof L.Marker) {
                        let markerWithTitle = l as Common.IMarkerWithTitle;
                        let geoSearchPage = _.find(response.data.query.geosearch, g => g.pageid.toString() === markerWithTitle.title);
                        if (geoSearchPage == null) {
                            this.markers.removeLayer(l);
                        } else {
                            response.data.query.geosearch.splice(response.data.query.geosearch.indexOf(geoSearchPage), 1);
                        }
                    }
                });

                for (let currentPage of response.data.query.geosearch) {

                    let marker = L.marker(L.latLng(currentPage.lat, currentPage.lon), { draggable: false, clickable: true, keyboard: false, icon: this.wikiMarkerIcon, title: currentPage.title } as L.MarkerOptions) as Common.IMarkerWithTitle;
                    marker.title = currentPage.pageid.toString();

                    let pageAddress = `https://${lang}.wikipedia.org/?curid=${currentPage.pageid}`;
                    let header = angular.element("<h4>")
                        .addClass(textAlign)
                        .css("margin-top", 0)
                        .attr("dir", dir).append(angular.element("<a>")
                            .attr("target", "_blank")
                            .attr("href", pageAddress)
                            .append(currentPage.title)
                        );
                    marker.bindPopup(header.wrap("<div></div>").html());
                    marker.on("popupopen", () => {
                        let popup = marker.getPopup();
                        let detailsUrl = `https://${lang}.wikipedia.org/w/api.php?format=json&action=query&pageids=${currentPage.pageid}&prop=extracts|pageimages&explaintext=true&exintro=true&exsentences=1&callback=JSON_CALLBACK`;
                        this.$http.jsonp(detailsUrl).then((detailsResponse: { data: IWikiResponse }) => {
                            let currentDetailedPage = detailsResponse.data.query.pages[currentPage.pageid];
                            let columnsClass = "col-xs-12";
                            if (currentDetailedPage.thumbnail) {
                                columnsClass = "col-xs-8";
                                currentDetailedPage.thumbnail.source = currentDetailedPage.thumbnail.source.replace(/\/\d\dpx/g, "/128px")
                            }
                            let container = angular.element("<div>").addClass("row").addClass("no-gutters").append(
                                angular.element("<div>").addClass(columnsClass).append(header).append(
                                    angular.element("<div>").addClass(textAlign).attr("dir", dir).append(currentDetailedPage.extract)
                                )
                            );
                            if (currentDetailedPage.thumbnail)
                            {
                                let imageConainer = angular.element("<div>").addClass("col-xs-4").append(
                                    angular.element("<img>").attr("src", currentDetailedPage.thumbnail.source).attr("width", "100%")
                                );
                                container.append(imageConainer);
                            }
                            let htmlString = container.wrap("<div></div>").parent().html();
                            popup.setContent(htmlString);
                            popup.update();
                        });
                    });
                    this.markers.addLayer(marker);
                }
            });
        }

        public getAttribution(): string {
            return "<a href='//creativecommons.org/licenses/by-sa/3.0/'>© Wikipadia CCA-SA</a>";
        }
    }
}