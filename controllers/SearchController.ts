module IsraelHiking.Controllers {
    export interface ISearchScope extends angular.IScope {
        isShowingSearch: boolean;
        isHebrew: boolean;
        addresses: ISearchResults[];
        searchTerm: string;
        toggleSearchBar(e: Event);
        getAddresses(searchTerm: string);
        selectAddress(address: ISearchResults): void;
    }

    interface ISearchResults {
        display: string;
        latlng: L.LatLng;
        searchTerm: string;
    }

    interface ISearchResultsQueueItem {
        searchTerm: string;
    }

    export class SearchController extends BaseMapController {
        private resultsQueue: ISearchResultsQueueItem[];
        private marker: L.Marker;

        constructor($scope: ISearchScope,
            $http: angular.IHttpService,
            $q: angular.IQService,
            mapService: Services.MapService,
            hashService: Services.HashService) {
            super(mapService);
            this.resultsQueue = [];
            this.marker = null;
            $scope.searchTerm = hashService.searchTerm;
            $scope.isShowingSearch = $scope.searchTerm.length > 0;
            $scope.isHebrew = this.hasHebrewCharacters($scope.searchTerm);
            $scope.addresses = [];

            $scope.toggleSearchBar = (e: Event) => {
                $scope.isShowingSearch = !$scope.isShowingSearch;
                this.suppressEvents(e);
            }

            $scope.getAddresses = (searchTerm: string) => {
                $scope.isHebrew = this.hasHebrewCharacters(searchTerm);

                if (searchTerm.length <= 2) {
                    return;
                }
                this.resultsQueue.push(<ISearchResultsQueueItem>{
                    searchTerm: searchTerm,
                    addresses: []
                });

                return $http.get("http://nominatim.openstreetmap.org/search/", {
                    params: {
                        q: searchTerm,
                        limit: 5,
                        format: "json",
                        addressdetails: 1,
                        countrycode: "il",
                        viewbox: "35.940941,33.43338,34.2677,29.4965",
                        bounded: "1",
                        namedetails: "1",
                        "accept-language": $scope.isHebrew ? "he-il" : "en-us",
                    }
                }).then((response: any): ISearchResults[]=> {
                    return this.handleSearchResponse($scope, response, searchTerm);
                });
            }

            $scope.selectAddress = (address: ISearchResults) => {
                mapService.map.panTo(address.latlng);
                if (this.marker == null) {
                    this.marker = L.marker(address.latlng);
                    this.marker.once("dblclick", () => {
                        mapService.map.removeLayer(this.marker);
                        this.marker = null;
                    });
                    mapService.map.addLayer(this.marker);
                } else {
                    this.marker.setLatLng(address.latlng);
                }
                this.marker.bindPopup(address.display);

                setTimeout(() => {
                    this.marker.openPopup();
                }, 300);
            }

            if ($scope.isShowingSearch) {
                $scope.getAddresses($scope.searchTerm);
            }

            $(window).bind("keydown", (e: JQueryEventObject) => {

                if (e.ctrlKey == false) {
                    return;
                }
                switch (String.fromCharCode(e.which).toLowerCase()) {
                    case "f":
                        $scope.toggleSearchBar(e);
                        break;
                    default:
                        return;
                }
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
                return false;
            });
        }

        private handleSearchResponse = ($scope: ISearchScope, response: any, searchTerm: string): ISearchResults[]=> {
            var queueItem = _.find(this.resultsQueue, (itemToFind) => itemToFind.searchTerm == searchTerm);
            if (queueItem == null || this.resultsQueue[this.resultsQueue.length - 1].searchTerm != searchTerm) {
                this.resultsQueue.splice(0, this.resultsQueue.length - 1);
                return;
            }
            $scope.addresses = [];
            for (var resultIndex = 0; resultIndex < response.data.length; resultIndex++) {
                var data = response.data[resultIndex];
                var address = data.address;
                var parts = [];
                var formattedAddress = "";
                if (address.road || address.building) {
                    formattedAddress += (address.building || "") + " " + (address.road || "") + " " + (address.house_number || "");
                }

                if (address.city || address.town || address.village) {
                    formattedAddress += (address.city || "") + (address.town || "") + (address.village || "");
                }
                if (data.namedetails) {
                    if ($scope.isHebrew) {
                        formattedAddress = data.namedetails.name + ", " + formattedAddress;
                    } else {
                        formattedAddress = data.namedetails["name:en"] + ", " + formattedAddress;
                    }
                }
                $scope.addresses.push(<ISearchResults> {
                    display: formattedAddress.replace("  ", " ").trim(),
                    latlng: L.latLng(data.lat, data.lon),
                    searchTerm: searchTerm,
                });
            }
            this.resultsQueue.splice(0, this.resultsQueue.length - 1);
        }

        private hasHebrewCharacters(searchTerm: string): boolean {
            return (searchTerm.match(/[\u0590-\u05FF]/gi) != null);
        }
    }

}