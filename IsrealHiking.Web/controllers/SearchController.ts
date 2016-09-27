namespace IsraelHiking.Controllers {

    export interface ISearchScope extends IRootScope {
        isShowingSearch: boolean;
        searchResults: Services.Search.ISearchResults[];
        searchTerm: string;
        activeSearchResult: Services.Search.ISearchResults;
        toggleSearchBar(e: Event);
        search(searchTerm: string);
        selectResult(address: Services.Search.ISearchResults, e: Event): void;
        ignoreClick(e: Event): void;
        keyDown(e: KeyboardEvent): void;
        getDirection(): string;
    }

    interface ISearchRequestQueueItem {
        searchTerm: string;
    }

    interface ISearchResultsMarkerPopup extends IRemovableMarkerScope {
        convertToRoute(): void;
    }

    export class SearchController extends BaseMapController {
        private static ENTER_KEY = 13;
        private static UP_KEY = 38;
        private static DOWN_KEY = 40;

        private requestsQueue: ISearchRequestQueueItem[];
        private layerGroup: L.LayerGroup<L.ILayer>;
        private elevationProvider: Services.Elevation.ElevationProvider;
        private searchResultsProviderFactory: Services.Search.SearchResultsProviderFactory;
        private toastr: Toastr;

        constructor($scope: ISearchScope,
            $window: angular.IWindowService,
            $timeout: angular.ITimeoutService,
            $compile: angular.ICompileService,
            mapService: Services.MapService,
            hashService: Services.HashService,
            layersService: Services.Layers.LayersService,
            elevationProvider: Services.Elevation.ElevationProvider,
            searchResultsProviderFactory: Services.Search.SearchResultsProviderFactory,
            toastr: Toastr) {
            super(mapService);
            this.requestsQueue = [];
            this.layerGroup = L.layerGroup();
            this.map.addLayer(this.layerGroup);
            this.elevationProvider = elevationProvider;
            this.searchResultsProviderFactory = searchResultsProviderFactory;
            this.toastr = toastr;
            $scope.searchTerm = hashService.searchTerm;
            $scope.isShowingSearch = $scope.searchTerm.length > 0;
            $scope.searchResults = [];
            $scope.activeSearchResult = null;

            $scope.toggleSearchBar = (e: Event) => {
                $scope.isShowingSearch = !$scope.isShowingSearch;
                this.suppressEvents(e);
            }

            $scope.search = (searchTerm: string) => {
                if (searchTerm.length <= 2) {
                    $scope.searchResults = [];
                    return;
                }
                this.internalSearch($scope);
            }

            if ($scope.isShowingSearch) {
                $scope.search($scope.searchTerm);
            }

            $scope.selectResult = (searchResults: Services.Search.ISearchResults, e: Event) => {
                $scope.isShowingSearch = false;
                $scope.activeSearchResult = searchResults;
                this.layerGroup.clearLayers();
                this.map.fitBounds(searchResults.bounds, { maxZoom: Services.Layers.LayersService.MAX_NATIVE_ZOOM } as L.Map.FitBoundsOptions);
                var marker = L.marker(searchResults.latlng, { icon: Services.IconsService.createSearchMarkerIcon(), draggable: false}) as Services.Layers.PoiLayers.IMarkerWithTitle;
                marker.title = searchResults.name || searchResults.address;
                let newScope = $scope.$new() as ISearchResultsMarkerPopup;
                newScope.marker = marker;
                newScope.remove = () => {
                    this.layerGroup.clearLayers();
                }
                newScope.convertToRoute = () => {
                    let segments = [] as Common.RouteSegmentData[];
                    if (searchResults.latlngsArray.length > 0) {
                        segments.push({
                            latlngzs: this.convertToLatLngZArray([searchResults.latlngsArray[0][0], searchResults.latlngsArray[0][0]]),
                            routePoint: searchResults.latlngsArray[0][0],
                            routingType: "Hike"
                        });
                        for (let latlngs of searchResults.latlngsArray) {
                            segments.push({
                                latlngzs: this.convertToLatLngZArray(latlngs),
                                routePoint: latlngs[latlngs.length - 1],
                                routingType: "Hike"
                            });
                        }    
                    }
                    layersService.setJsonData({
                        markers: [{ latlng: searchResults.latlng, title: marker.title }],
                        routes: [{ segments: segments, name: marker.title}]
                    } as Common.DataContainer);
                    this.layerGroup.clearLayers();
                }
                marker.bindPopup($compile("<div search-results-marker-popup></div>")(newScope)[0]);

                this.layerGroup.addLayer(marker);
                for (let line of searchResults.latlngsArray) {
                    let polyLine = L.polyline(line, { opacity: 1, color: "Blue", weight: 3 } as L.PolylineOptions);
                    this.layerGroup.addLayer(polyLine);
                }

                $timeout(() => {
                    marker.openPopup();
                }, 300);
                this.suppressEvents(e);
            }

            $scope.ignoreClick = (e: Event) => {
                this.suppressEvents(e);
            }

            $scope.keyDown = (e: KeyboardEvent): void => {
                if ($scope.isShowingSearch === false) {
                    return;
                }
                let index = $scope.searchResults.indexOf($scope.activeSearchResult);
                switch (e.keyCode) {
                    case SearchController.UP_KEY:
                        index = (index - 1) % $scope.searchResults.length;
                        if (index < 0) {
                            index = $scope.searchResults.length - 1;
                        }
                        $scope.activeSearchResult = $scope.searchResults[index];
                        break;
                    case SearchController.DOWN_KEY:
                        index = (index + 1) % $scope.searchResults.length;
                        $scope.activeSearchResult = $scope.searchResults[index];
                        break;
                    case SearchController.ENTER_KEY:
                        if ($scope.activeSearchResult) {
                            $scope.selectResult($scope.activeSearchResult, e);
                        } else {
                            this.internalSearch($scope);
                        }
                        break;
                }
            }

            $scope.getDirection = () => {
                if (!$scope.searchTerm) {
                    return $scope.resources.direction;
                }
                return $scope.hasHebrewCharacters($scope.searchTerm) ? "rtl" : "ltr";
            }

            /**
             * Globally used keydown to catch ctrl+f in order to open this search controller
             */
            angular.element($window).bind("keydown", (e: JQueryEventObject) => {
                if (e.ctrlKey === false) {
                    return true;
                }
                switch (String.fromCharCode(e.which).toLowerCase()) {
                    case "f":
                        $scope.toggleSearchBar(e);
                        break;
                    default:
                        return true;
                }
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
                return false;
            });
        }

        private convertToLatLngZArray = (latlngs: L.LatLng[]): Common.LatLngZ[] => {
            let latlngZ = [] as  Common.LatLngZ[];
            for (let latlng of latlngs) {
                latlngZ.push(angular.extend({ z: 0 }, latlng));
            }
            this.elevationProvider.updateHeights(latlngZ);
            return latlngZ;
        }

        private internalSearch = ($scope: ISearchScope) => {
            let searchTerm = $scope.searchTerm;
            this.requestsQueue.push({
                searchTerm: searchTerm
            } as ISearchRequestQueueItem);

            var local = this.searchResultsProviderFactory.create(Services.Search.SearchProviderType.local);

            local.getResults(searchTerm, $scope.hasHebrewCharacters(searchTerm))
                .then((results: Services.Search.ISearchResults[]) => {
                    let queueItem = _.find(this.requestsQueue, (itemToFind) => itemToFind.searchTerm === searchTerm);
                    if (queueItem == null || this.requestsQueue.indexOf(queueItem) !== this.requestsQueue.length - 1) {
                        this.requestsQueue.splice(0, this.requestsQueue.length - 1);
                        return;
                    }
                    if ($scope.searchTerm !== searchTerm) {
                        // search term changed since it was requested.
                        _.remove(this.requestsQueue, queueItem);
                        return;
                    }
                    $scope.searchResults = results;
                    this.requestsQueue.splice(0);
                }, () => {
                    this.toastr.warning("Unable to get search results.");
                });
        }
    }

}