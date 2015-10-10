module IsraelHiking.Services.Elevation {
    export class MicrosoftElevationProvider implements IElevationProvider {
        private static VIRTUAL_EARTH_BASE_ADDRESS = "http://dev.virtualearth.net/REST/v1/Elevation/List?jsonp=JSON_CALLBACK";

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
                    pointsString += latlngz.lat.toFixed(4) + "," + latlngz.lng.toFixed(4) + ",";
                }
            }
            if (filteredArray.length == 0) {
                return;
            }
            pointsString = pointsString.substr(0, pointsString.length - 1);
            return this.$http.jsonp(MicrosoftElevationProvider.VIRTUAL_EARTH_BASE_ADDRESS, {
                params: {
                    key: "ArUJIOvdEI-4sFS5-3PqMlDJP-00FMLrOeLIGkLRpfWIjfpOcESgnE-Zmk-ZimU2",
                    points: pointsString,
                }
            }).success((data: any) => {
                var resourceSets = data.resourceSets;
                if (resourceSets.length == 0) {
                    return;
                }
                var resources = resourceSets[0].resources;
                if (resources.length == 0) {
                    return;
                }
                var elevations = resources[0].elevations;
                if (elevations.length == 0 || elevations.length < filteredArray.length) {
                    return;
                }
                for (var index = 0; index < filteredArray.length; index++) {
                    filteredArray[index].z = elevations[index];
                }
            }).error(() => {
                console.log("Height requests failed: " + pointsString)
            });
        }
    }


}