module IsraelHiking.Services.Elevation {
    export class ElevationProvider implements IElevationProvider {
        private $http: angular.IHttpService;

        constructor($http: angular.IHttpService) {
            this.$http = $http;
        }

        public updateHeights(latlngzs: Common.LatLngZ[]): angular.IHttpPromise<{}> {
            var filteredArray = <Common.LatLngZ[]>[];
            var pointsString = "";
            for (var index = 0; index < latlngzs.length; index++) {
                var latlngz = latlngzs[index];
                if (latlngz.z == 0) {
                    filteredArray.push(latlngz);
                    pointsString += "point=" + latlngz.lat.toFixed(4) + "," + latlngz.lng.toFixed(4) + "&";
                }
            }
            if (filteredArray.length == 0) {
                return;
            }

            pointsString = pointsString.substr(0, pointsString.length - 1);
            return this.$http.get("http://31.154.13.99/api/elevation?" + pointsString)
                .success((data: number[]) => {
                    for (var index = 0; index < filteredArray.length; index++) {
                        filteredArray[index].z = data[index];
                    }
                }).error(() => {
                    console.log("Elevation request failed: " + pointsString)
                });
        }
    }
}