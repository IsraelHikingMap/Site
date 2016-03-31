module IsraelHiking.Controllers {

    export interface ISearchScope extends angular.IScope {
        isShowingSearch: boolean;
        isHebrew: boolean;
        searchResults: Services.Search.ISearchResults[];
        searchTerm: string;
        toggleSearchBar(e: Event);
        search(searchTerm: string);
        selectResult(address: Services.Search.ISearchResults, e: Event): void;
        ignoreClick(e: Event): void;
    }

    interface ISearchResultsQueueItem {
        searchTerm: string;
    }

    export class SearchController extends BaseMapController {
        private resultsQueue: ISearchResultsQueueItem[];
        private layerGroup:  L.LayerGroup<L.ILayer>;

        constructor($scope: ISearchScope,
            $timeout: angular.ITimeoutService,
            mapService: Services.MapService,
            hashService: Services.HashService,
            searchResultsProviderFactory: Services.Search.SearchResultsProviderFactory,
            toastr: Toastr) {
            super(mapService);
            this.resultsQueue = [];
            this.layerGroup = L.layerGroup();
            this.map.addLayer(this.layerGroup);
            $scope.searchTerm = hashService.searchTerm;
            $scope.isShowingSearch = $scope.searchTerm.length > 0;
            $scope.isHebrew = this.hasHebrewCharacters($scope.searchTerm);
            $scope.searchResults = [];

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
                this.resultsQueue.push({
                    searchTerm: searchTerm,
                    addresses: []
                } as ISearchResultsQueueItem);

                //var nominatim = searchResultsProviderFactory.create(Services.Search.SearchProviderType.nominatim);
                //var overpass = searchResultsProviderFactory.create(Services.Search.SearchProviderType.overpass);
                var local = searchResultsProviderFactory.create(Services.Search.SearchProviderType.local);

                local.getResults(searchTerm, $scope.isHebrew)
                //nominatim.getResults(searchTerm, $scope.isHebrew)
                    .then((results: Services.Search.ISearchResults[]) => {
                    var queueItem = _.find(this.resultsQueue, (itemToFind) => itemToFind.searchTerm === searchTerm);
                    if (queueItem == null || this.resultsQueue.indexOf(queueItem) !== this.resultsQueue.length - 1) {
                        this.resultsQueue.splice(0, this.resultsQueue.length - 1);
                        return;
                    }
                    $scope.searchResults = results;
                    //overpass.getResults(searchTerm, $scope.isHebrew).then((additionalResults: Services.Search.ISearchResults[]) => {
                    //    for (let additionalResult of additionalResults) {
                    //        $scope.searchResults.push(additionalResult);
                    //    }
                    //});
                }, () => {
                    toastr.warning("Unable to get search results.");
                });
            }

            $scope.selectResult = (searchResults: Services.Search.ISearchResults, e: Event) => {
                $scope.isShowingSearch = false;
                this.layerGroup.clearLayers();
                this.map.fitBounds(searchResults.bounds);
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

            $(window).bind("keydown", (e: JQueryEventObject) => {

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