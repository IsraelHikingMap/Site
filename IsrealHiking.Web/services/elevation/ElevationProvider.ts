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
            var pointsString = "";
            for (let latlngz of latlngzs) {
                if (latlngz.z === 0) {
                    filteredArray.push(latlngz);
                    pointsString += `point=${latlngz.lat.toFixed(4)},${latlngz.lng.toFixed(4)}&`;
                }
            }
            if (filteredArray.length === 0) {
                return;
            }

            pointsString = pointsString.substr(0, pointsString.length - 1);
            return this.$http.get(Common.Urls.elevation + "?" + pointsString)
                .success((data: number[]) => {
                    for (var index = 0; index < filteredArray.length; index++) {
                        filteredArray[index].z = data[index];
                    }
                }).error(() => {
                    this.toastr.error(this.resourcesService.unableToGetElevationData + " " + pointsString);
                });
        }
    }
}