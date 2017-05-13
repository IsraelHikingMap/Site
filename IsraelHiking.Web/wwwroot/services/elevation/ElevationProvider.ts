namespace IsraelHiking.Services.Elevation {
    export class ElevationProvider implements IElevationProvider {
        private $http: angular.IHttpService;
        private resourcesService: ResourcesService;
        private toastr: Toastr;

        constructor($http: angular.IHttpService,
            resourcesService: ResourcesService,
            toastr: Toastr) {
            this.$http = $http;
            this.resourcesService = resourcesService;
            this.toastr = toastr;
        }

        public updateHeights = (latlngs: L.LatLng[]): angular.IHttpPromise<{}> => {
            var filteredArray = [] as L.LatLng[];
            var points = [];
            for (let latlng of latlngs) {
                if (latlng.alt) {
                    continue;
                }
                filteredArray.push(latlng);
                points.push(`${latlng.lat.toFixed(4)},${latlng.lng.toFixed(4)}`);
            }
            if (filteredArray.length === 0) {
                return;
            }
            let promise = this.$http.get(Common.Urls.elevation, { params: { points: points.join("|") } } as angular.IRequestShortcutConfig);
            promise.then((response: { data: number[] }) => {
                for (let index = 0; index < filteredArray.length; index++) {
                    filteredArray[index].alt = response.data[index];
                }
            }, () => {
                this.toastr.error(this.resourcesService.unableToGetElevationData);
            });
            return promise;
        }
    }
}