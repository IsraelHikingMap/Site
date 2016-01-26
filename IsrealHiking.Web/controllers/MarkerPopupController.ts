module IsraelHiking.Controllers {
    interface INorthEast {
        North: number;
        East: number;
    }

    export interface IMarkerPopupScope extends angular.IScope {
        title: string;
        setTitle(title: string): void;
        itmCoordinates: INorthEast;
        marker: IsraelHiking.Services.Drawing.MarkerWithTitle;
        latLng: L.LatLng;
    }

    export class MarkerPopupController {
        constructor($scope: IMarkerPopupScope,
            $http: angular.IHttpService) {
            $scope.marker.on("popupopen", () => {
                $scope.latLng = $scope.marker.getLatLng();
                $http.get(Common.Urls.itmGrid, <angular.IRequestShortcutConfig> {
                    params: {
                        lat: $scope.latLng.lat,
                        lon: $scope.latLng.lng
                    }
                }).success((northEast: INorthEast) => {
                    $scope.itmCoordinates = northEast;
                });
            });
        }
    }
} 