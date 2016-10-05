namespace IsraelHiking.Services.Search {

    export interface ISearchResultsProvider  {
        getResults: (searchTerm: string, isHebrew: boolean) => angular.IPromise<ISearchResults[]>;
    }

    export interface ISearchResults {
        name: string;
        address: string;
        icon: string;
        searchTerm: string;
        latlng: L.LatLng;
        latlngsArray: L.LatLng[][];
        bounds: L.LatLngBounds;
        displayName: string;
        feature: GeoJSON.Feature<GeoJSON.GeometryObject>;
    }

    export abstract class BaseSearchResultsProvider implements ISearchResultsProvider {
        protected $http: angular.IHttpService;
        protected $q: angular.IQService;
        protected static bounds = L.latLngBounds(L.latLng(29.4965, 34.2677), L.latLng(33.43338, 35.940941));

        constructor($http: angular.IHttpService,
            $q: angular.IQService) {
            this.$http = $http;
            this.$q = $q;
        }

        public getResults = (searchTerm: string, isHebrew: boolean): angular.IPromise<ISearchResults[]> => { throw new Error("Should be implemented in derived."); }
    }
}