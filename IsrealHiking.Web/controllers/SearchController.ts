namespace IsraelHiking.Controllers {

    export interface ISearchScope extends angular.IScope {
        isShowingSearch: boolean;
        isHebrew: boolean;
        searchResults: Services.Search.ISearchResults[];
        searchTerm: string;
        activeSearchResult: Services.Search.ISearchResults;
        toggleSearchBar(e: Event);
        search(searchTerm: string);
        selectResult(address: Services.Search.ISearchResults, e: Event): void;
        ignoreClick(e: Event): void;
        keyDown(e: KeyboardEvent): void;
    }

    interface ISearchRequestQueueItem {
        searchTerm: string;
    }

    export class SearchController extends BaseMapController {
        private static ENTER_KEY = 13;
        private static UP_KEY = 38;
        private static DOWN_KEY = 40;

        private requestsQueue: ISearchRequestQueueItem[];
        private layerGroup: L.LayerGroup<L.ILayer>;

        constructor($scope: ISearchScope,
            $window: angular.IWindowService,
            $timeout: angular.ITimeoutService,
            mapService: Services.MapService,
            hashService: Services.HashService,
            searchResultsProviderFactory: Services.Search.SearchResultsProviderFactory,
            toastr: Toastr) {
            super(mapService);
            this.requestsQueue = [];
            this.layerGroup = L.layerGroup();
            this.map.addLayer(this.layerGroup);
            $scope.searchTerm = hashService.searchTerm;
            $scope.isShowingSearch = $scope.searchTerm.length > 0;
            $scope.isHebrew = this.hasHebrewCharacters($scope.searchTerm);
            $scope.searchResults = [];
            $scope.activeSearchResult = null;

            $scope.toggleSearchBar = (e: Event) => {
                $scope.isShowingSearch = !$scope.isShowingSearch;
                this.suppressEvents(e);
            }

            $scope.search = (searchTerm: string) => {
                $scope.isHebrew = this.hasHebrewCharacters(searchTerm);

                if (searchTerm.length <= 2) {
                    $scope.searchResults = [];
                    return;
                }
                this.requestsQueue.push({
                    searchTerm: searchTerm
                } as ISearchRequestQueueItem);

                var local = searchResultsProviderFactory.create(Services.Search.SearchProviderType.local);

                local.getResults(searchTerm, $scope.isHebrew)
                    .then((results: Services.Search.ISearchResults[]) => {
                        let queueItem = _.find(this.requestsQueue, (itemToFind) => itemToFind.searchTerm === searchTerm);
                        if (queueItem == null || this.requestsQueue.indexOf(queueItem) !== this.requestsQueue.length - 1) {
                            this.requestsQueue.splice(0, this.requestsQueue.length - 1);
                            return;
                        }
                        $scope.searchResults = results;
                        this.requestsQueue.splice(0);
                    }, () => {
                        toastr.warning("Unable to get search results.");
                    });
            }

            $scope.selectResult = (searchResults: Services.Search.ISearchResults, e: Event) => {
                $scope.isShowingSearch = false;
                $scope.activeSearchResult = searchResults;
                this.layerGroup.clearLayers();
                this.map.fitBounds(searchResults.bounds, <L.Map.FitBoundsOptions>{ maxZoom: Services.Layers.LayersService.MAX_NATIVE_ZOOM });
                var marker = L.marker(searchResults.latlng);
                marker.bindPopup(searchResults.name || searchResults.address);
                marker.once("dblclick", () => {
                    this.layerGroup.clearLayers();
                });
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

            if ($scope.isShowingSearch) {
                $scope.search($scope.searchTerm);
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
                        $scope.selectResult($scope.activeSearchResult, e);
                        break;
                }
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

        private hasHebrewCharacters(searchTerm: string): boolean {
            return (searchTerm.match(/[\u0590-\u05FF]/gi) != null);
        }
    }

}