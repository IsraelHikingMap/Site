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

        public updateHeights = (latlngzs: Common.LatLngZ[]): angular.IHttpPromise<{}> => {
            var filteredArray = [] as Common.LatLngZ[];
            var points = [];
            for (let latlngz of latlngzs) {
                if (latlngz.z !== 0) {
                    continue;
                }
                filteredArray.push(latlngz);
                points.push(`${latlngz.lat.toFixed(4)},${latlngz.lng.toFixed(4)}`);
            }
            if (filteredArray.length === 0) {
                return;
            }
            let promise = this.$http.get(Common.Urls.elevation, { params: { points: points.join("|") } } as angular.IRequestShortcutConfig);
            promise.then((response: { data: number[] }) => {
                    for (let index = 0; index < filteredArray.length; index++) {
                        filteredArray[index].z = response.data[index];
                    }
                }, () => {
                    this.toastr.error(this.resourcesService.unableToGetElevationData);
                });
            return promise;
        }
    }
}