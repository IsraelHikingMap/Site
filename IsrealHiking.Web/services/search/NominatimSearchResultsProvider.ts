namespace IsraelHiking.Services.Search {

    export interface INominatimRequest {
        q: string;
        limit: number;
        format: string;
        addressdetails: number;
        countrycode: string;
        viewbox: string;
        bounded: number;
        namedetails: number;
        polygon: number;
        exclude_place_ids: string;
        "accept-language": string;
    }

    export interface INominatimAddress {
        road: string;
        house_number: string;
        building: string;
        city: string;
        town: string;
        village: string;
    }

    export interface INominatimResponse {
        place_id: string;
        boundingbox: string[];
        polygonpoints: number[][];
        lat: number;
        lon: number;
        display_name: string;
        icon: string;
        address: INominatimAddress;
        namedetails: {name: string, "name:en": string };
    }

    export class NominatimSearchResultsProvider extends BaseSearchResultsProvider {

        private static LIMIT = 5;
        private static NOMINATIM_ADDRESS = "http://nominatim.openstreetmap.org/";

        constructor($http: angular.IHttpService,
            $q: angular.IQService) {
            super($http, $q);
        }

        private static getBoundsString() {
            return [this.bounds.getNorthEast().lng, this.bounds.getNorthEast().lat,
                    this.bounds.getSouthWest().lng, this.bounds.getSouthWest().lat].join(",");
        }

        public getResults = (searchTerm: string, isHebrew: boolean): angular.IPromise<ISearchResults[]> => {
            var deferred = this.$q.defer();
            let requestParameters = this.getDefaultRequestParameters(searchTerm, isHebrew);
            this.$http.get(NominatimSearchResultsProvider.NOMINATIM_ADDRESS, {
                params: requestParameters
            }).success((response: INominatimResponse[]) => {
                var addresses = this.handleSearchResponse(response, searchTerm, isHebrew);
                if (response.length < NominatimSearchResultsProvider.LIMIT) {
                    this.requestForMoreResults(searchTerm,
                        NominatimSearchResultsProvider.LIMIT - response.length,
                        _.map(response, r => r.place_id).join(","),
                        isHebrew).then((additionalAddresses) => {
                        for (let additionalAddress of additionalAddresses) {
                            addresses.push(additionalAddress);
                        }
                        deferred.resolve(addresses);
                    }, (err) => { deferred.reject(err) });
                } else {
                    deferred.resolve(addresses);
                }
            }).error((err) => {
                deferred.reject(err);
            });
            return deferred.promise;
        }

        private handleSearchResponse = (response: INominatimResponse[], searchTerm: string, isHebrew: boolean): ISearchResults[] => {
            let addresses = [] as ISearchResults[];
            for (let data of response) {
                var formattedAddress = "";
                if (data.address.road || data.address.building) {
                    formattedAddress += (data.address.building || "") + " " + (data.address.road || "") + " " + (data.address.house_number || "");
                }

                if (data.address.city || data.address.town || data.address.village) {
                    formattedAddress += (data.address.city || "") + (data.address.town || "") + (data.address.village || "");
                }
                formattedAddress = formattedAddress.replace("  ", " ").trim();
                let name = formattedAddress;
                if (data.namedetails) {
                    name = isHebrew ? data.namedetails.name : data.namedetails["name:en"];
                }
                var latlngs = [];
                for (let polygonPoint of data.polygonpoints) {
                    latlngs.push(L.latLng(polygonPoint[1], polygonPoint[0]));
                }
                addresses.push({
                    name: name,
                    address: formattedAddress,
                    icon: data.icon,
                    latlng: L.latLng(data.lat, data.lon),
                    latlngsArray: [latlngs],
                    searchTerm: searchTerm
                } as ISearchResults);
            }
            return addresses;
        }

        private requestForMoreResults = (searchTerm: string, limit: number, exclude: string, isHebrew: boolean) : angular.IPromise<ISearchResults[]> => {
            var deferred = this.$q.defer();
            let requestParameters = this.getDefaultRequestParameters(searchTerm, isHebrew);
            requestParameters.limit = limit;
            requestParameters.exclude_place_ids = exclude;
            this.$http.get(NominatimSearchResultsProvider.NOMINATIM_ADDRESS, { params: requestParameters }).success((response: INominatimResponse[]) => {
                deferred.resolve(this.handleSearchResponse(response, searchTerm, isHebrew));  
            }).error((err) => {
                deferred.reject(err);
            });
            return deferred.promise;
        }

        private getDefaultRequestParameters = (searchTerm: string, isHebrew: boolean) => {
            return {
                q: searchTerm,
                limit: NominatimSearchResultsProvider.LIMIT,
                format: "json",
                addressdetails: 1,
                countrycode: "il",
                viewbox: NominatimSearchResultsProvider.getBoundsString(),
                bounded: 1,
                namedetails: 1,
                polygon: 1,
                "accept-language": isHebrew ? "he-il" : "en-us"
            } as INominatimRequest;
        }
    }
}