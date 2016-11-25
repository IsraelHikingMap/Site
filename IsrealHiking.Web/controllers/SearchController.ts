namespace IsraelHiking.Controllers {

    export interface ISearchContext {
        searchTerm: string;
        searchResults: Services.Search.ISearchResults[];
        selectedSearchResults: Services.Search.ISearchResults;
        highlightedSearchResults: Services.Search.ISearchResults;
        hasFocus: boolean;
    }

    export interface ISearchScope extends IRootScope {
        isVisible: boolean;
        isDirectional: boolean;
        fromContext: ISearchContext;
        toContext: ISearchContext;
        routingType: Common.RoutingType;
        toggleVisibility(e: Event);
        toggleDirectional(e: Event);
        search(searchContext: ISearchContext);
        keyDown(searchContext: ISearchContext, e: KeyboardEvent): void;
        getDirection(words: string): string;
        getTextAlignment(words: string): string;
        moveToResults(searchResults: Services.Search.ISearchResults, e: Event): void;
        selectResults(searchContext: ISearchContext, results: Services.Search.ISearchResults, e: Event): void;
        changeFocus(searchContext: ISearchContext, e: Event): void;
        searchRoute(e: Event): void;
        setRouting(routingType: Common.RoutingType, e: Event): void;
        removeSelectedResults(searchContext: ISearchContext, e: Event): void;
    }

    interface ISearchRequestQueueItem {
        searchTerm: string;
    }

    export interface ISearchResultsMarkerPopup extends IRemovableMarkerScope {
        convertToRoute(): void;
    }

    export class SearchController extends BaseMapController {
        private static ENTER_KEY = 13;
        private static UP_KEY = 38;
        private static DOWN_KEY = 40;

        private requestsQueue: ISearchRequestQueueItem[];
        private featureGroup: L.FeatureGroup<L.ILayer>;
        private elevationProvider: Services.Elevation.ElevationProvider;
        private localSearchResultsProvider: Services.Search.LocalSearchResultsProvider;
        private layersService: Services.Layers.LayersService;
        private toastr: Toastr;

        constructor($scope: ISearchScope,
            $window: angular.IWindowService,
            $timeout: angular.ITimeoutService,
            $compile: angular.ICompileService,
            $http: angular.IHttpService,
            mapService: Services.MapService,
            hashService: Services.HashService,
            layersService: Services.Layers.LayersService,
            elevationProvider: Services.Elevation.ElevationProvider,
            localSearchResultsProvider: Services.Search.LocalSearchResultsProvider,
            routerService: Services.Routers.RouterService,
            toastr: Toastr) {
            super(mapService);
            this.requestsQueue = [];
            this.featureGroup = L.featureGroup();
            this.map.addLayer(this.featureGroup);
            this.elevationProvider = elevationProvider;
            this.layersService = layersService;
            this.localSearchResultsProvider = localSearchResultsProvider;
            this.toastr = toastr;
            $scope.isVisible = false;
            $scope.isDirectional = false;
            $scope.routingType = "Hike";
            $scope.fromContext = {
                searchTerm: "",
                searchResults: [],
                selectedSearchResults: null,
                highlightedSearchResults: null
            } as ISearchContext;
            $scope.toContext = {
                searchTerm: "",
                searchResults: [],
                selectedSearchResults: null,
                highlightedSearchResults: null
            } as ISearchContext;
            $scope.fromContext.searchTerm = hashService.searchTerm;
            $scope.isVisible = $scope.fromContext.searchTerm ? true : false;
            this.setFocus($scope);

            $scope.toggleVisibility = (e: Event) => {
                $scope.isVisible = !$scope.isVisible;
                this.setFocus($scope);
                this.suppressEvents(e);
            }

            $scope.toggleDirectional = (e: Event) => {
                $scope.isDirectional = !$scope.isDirectional;
                this.setFocus($scope);
                this.suppressEvents(e);
            }

            $scope.search = (searchContext: ISearchContext) => {
                if (searchContext.searchTerm.length <= 2) {
                    searchContext.searchResults = [];
                    return;
                }
                this.internalSearch($scope, searchContext);
            }

            if ($scope.isVisible) {
                $scope.search($scope.fromContext);
            }

            $scope.moveToResults = (searchResults: Services.Search.ISearchResults, e: Event) => {
                $scope.toggleVisibility(e);
                this.featureGroup.clearLayers();
                this.map.fitBounds(searchResults.bounds, { maxZoom: Services.Layers.LayersService.MAX_NATIVE_ZOOM } as L.Map.FitBoundsOptions);
                var marker = L.marker(searchResults.latlng, { icon: Services.IconsService.createSearchMarkerIcon(), draggable: false}) as Services.Layers.PoiLayers.IMarkerWithTitle;
                marker.title = searchResults.name || searchResults.address;
                let newScope = $scope.$new() as ISearchResultsMarkerPopup;
                newScope.marker = marker;
                newScope.remove = () => {
                    this.featureGroup.clearLayers();
                }
                newScope.convertToRoute = () => {
                    $http.post(Common.Urls.search, searchResults.feature).then((response: {data: Common.DataContainer }) => {
                        layersService.setJsonData({
                            markers: [{ latlng: searchResults.latlng, title: marker.title }],
                            routes: response.data.routes
                        } as Common.DataContainer);
                        this.featureGroup.clearLayers();
                    });
                }
                marker.bindPopup($compile("<div search-results-marker-popup></div>")(newScope)[0], { className: "marker-popup" } as L.PopupOptions);

                this.featureGroup.addLayer(marker);
                for (let line of searchResults.latlngsArray) {
                    let polyLine = L.polyline(line, this.getPathOprtions());
                    this.featureGroup.addLayer(polyLine);
                }

                $timeout(() => {
                    marker.openPopup();
                }, 300);
                this.suppressEvents(e);
            }

            $scope.changeFocus = (searchContext: ISearchContext, e: Event) => {
                searchContext.hasFocus = true;
                if (searchContext === $scope.fromContext) {
                    $scope.toContext.hasFocus = false;
                } else {
                    $scope.fromContext.hasFocus = false;
                }
                if (e.currentTarget != null) {
                    angular.element(e.currentTarget).focus();
                }
                this.suppressEvents(e);
            }

            $scope.keyDown = (searchContext: ISearchContext, e: KeyboardEvent): void => {
                if ($scope.isVisible === false) {
                    return;
                }
                let index = searchContext.searchResults.indexOf(searchContext.highlightedSearchResults);
                switch (e.keyCode) {
                    case SearchController.UP_KEY:
                        index = (index - 1) % searchContext.searchResults.length;
                        if (index < 0) {
                            index = searchContext.searchResults.length - 1;
                        }
                        searchContext.highlightedSearchResults = searchContext.searchResults[index];
                        break;
                    case SearchController.DOWN_KEY:
                        index = (index + 1) % searchContext.searchResults.length;
                        searchContext.highlightedSearchResults = searchContext.searchResults[index];
                        break;
                    case SearchController.ENTER_KEY:
                        if (searchContext.highlightedSearchResults) {
                            $scope.selectResults(searchContext, searchContext.highlightedSearchResults, e);
                        } else {
                            this.internalSearch($scope, searchContext);
                        }
                        break;
                }
            }

            $scope.selectResults = (searchContext: ISearchContext, searchResult: Services.Search.ISearchResults, e: Event) => {
                searchContext.selectedSearchResults = searchResult;
                searchContext.highlightedSearchResults = searchResult;
                if (!$scope.isDirectional) {
                    $scope.moveToResults(searchResult, e);
                }
                this.setFocus($scope);
            };

            $scope.getDirection = (words: string) => {
                if (!words) {
                    return $scope.resources.direction;
                }
                return $scope.hasHebrewCharacters(words) ? "rtl" : "ltr";
            }

            $scope.getTextAlignment = (words: string) => {
                return `text-${$scope.getDirection(words) === "rtl" ? "right" : "left"}`;
            }

            $scope.removeSelectedResults = (searchContext: ISearchContext, e: Event) => {
                searchContext.selectedSearchResults = null;
                this.setFocus($scope);
                this.suppressEvents(e);
            }

            $scope.setRouting = (routingType: Common.RoutingType, e: Event) => {
                $scope.routingType = routingType;
                this.suppressEvents(e);
            }

            $scope.searchRoute = (e: Event) => {
                this.suppressEvents(e);
                if (!$scope.fromContext.selectedSearchResults) {
                    toastr.warning($scope.resources.pleaseSelectFrom);
                    return;
                }
                if (!$scope.toContext.selectedSearchResults) {
                    toastr.warning($scope.resources.pleaseSelectTo);
                    return;
                }
                routerService.getRoute($scope.fromContext.selectedSearchResults.latlng, $scope.toContext.selectedSearchResults.latlng, $scope.routingType).then((response: Common.RouteSegmentData[]) => {
                    this.featureGroup.clearLayers();
                    for (let segment of response) {
                        let polyLine = L.polyline(segment.latlngzs, this.getPathOprtions());
                        this.featureGroup.addLayer(polyLine);
                    }
                    var markerFrom = L.marker($scope.fromContext.selectedSearchResults.latlng, { icon: Services.IconsService.createStartIcon(), draggable: false }) as Services.Layers.PoiLayers.IMarkerWithTitle;
                    markerFrom.title = $scope.fromContext.selectedSearchResults.name || $scope.fromContext.selectedSearchResults.address;
                    var markerTo = L.marker($scope.toContext.selectedSearchResults.latlng, { icon: Services.IconsService.createEndIcon(), draggable: false }) as Services.Layers.PoiLayers.IMarkerWithTitle;
                    markerTo.title = $scope.toContext.selectedSearchResults.name || $scope.toContext.selectedSearchResults.address;

                    let convertToRoute = () => {
                        
                        layersService.setJsonData({
                            markers: [
                                { latlng: markerFrom.getLatLng(), title: markerFrom.title },
                                { latlng: markerTo.getLatLng(), title: markerTo.title }
                            ],
                            routes: [{ segments: response, name: markerFrom.title + "-" + markerTo.title }]
                        } as Common.DataContainer);
                        this.featureGroup.clearLayers();
                    }

                    let newScopeFrom = $scope.$new() as ISearchResultsMarkerPopup;
                    newScopeFrom.marker = markerFrom;
                    newScopeFrom.remove = () => {
                        this.featureGroup.clearLayers();
                    }
                    newScopeFrom.convertToRoute = convertToRoute;
                    let newScopeTo = $scope.$new() as ISearchResultsMarkerPopup;
                    newScopeTo.marker = markerTo;
                    newScopeTo.remove = () => {
                        this.featureGroup.clearLayers();
                    }
                    newScopeTo.convertToRoute = convertToRoute;

                    markerFrom.bindPopup($compile("<div search-results-marker-popup></div>")(newScopeFrom)[0], { className: "marker-popup" } as L.PopupOptions);
                    markerTo.bindPopup($compile("<div search-results-marker-popup></div>")(newScopeTo)[0], { className: "marker-popup" } as L.PopupOptions);
                    this.featureGroup.addLayer(markerFrom);
                    this.featureGroup.addLayer(markerTo);

                    this.map.fitBounds(this.featureGroup.getBounds());

                    $timeout(() => {
                        markerTo.openPopup();
                    }, 300);
                });
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
                        $scope.toggleVisibility(e);
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

        private internalSearch = ($scope: ISearchScope, searchContext: ISearchContext) => {
            let searchTerm = searchContext.searchTerm;
            this.requestsQueue.push({
                searchTerm: searchTerm
            } as ISearchRequestQueueItem);

            this.localSearchResultsProvider.getResults(searchTerm, hasHebrewCharacters(searchTerm))
                .then((results: Services.Search.ISearchResults[]) => {
                    let queueItem = _.find(this.requestsQueue, (itemToFind) => itemToFind.searchTerm === searchTerm);
                    if (queueItem == null || this.requestsQueue.indexOf(queueItem) !== this.requestsQueue.length - 1) {
                        this.requestsQueue.splice(0, this.requestsQueue.length - 1);
                        return;
                    }
                    if (searchContext.searchTerm !== searchTerm) {
                        // search term changed since it was requested.
                        _.remove(this.requestsQueue, queueItem);
                        return;
                    }
                    searchContext.searchResults = results;
                    this.requestsQueue.splice(0);
                }, () => {
                    this.toastr.warning($scope.resources.unableToGetSearchResults);
                });
        }

        private getPathOprtions = (): L.PathOptions => {
            return { opacity: 1, color: "Blue", weight: 3 } as L.PathOptions;
        }

        private setFocus = ($scope: ISearchScope) => {
            $scope.fromContext.hasFocus = false;
            $scope.toContext.hasFocus = false;
            if ($scope.isVisible === false) {
                return;
            }
            if (!$scope.isDirectional) {
                $scope.fromContext.hasFocus = true;
            } else {
                if ($scope.fromContext.selectedSearchResults) {
                    $scope.toContext.hasFocus = true;
                } else {
                    $scope.fromContext.hasFocus = true;
                }
                if ($scope.toContext.selectedSearchResults) {
                    $scope.toContext.hasFocus = false;
                }
            }
        }
    }

}