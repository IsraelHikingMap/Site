module IsraelHiking.Controllers {
    interface INorthEast {
        North: number;
        East: number;
    }

    export interface IMarkerPopupScope extends angular.IScope {
        title: string;
        setTitle(title: string): void;
        itmCoordinates: INorthEast;
        marker: IsraelHiking.Services.Drawing.MarkerWithTitle
    }

    export class MarkerPopupController {
        constructor($scope: IMarkerPopupScope,
            $http: angular.IHttpService) {
            $scope.marker.on("popupopen", () => {
                var latLng = $scope.marker.getLatLng();
                $http.get(Common.Urls.itmGrid, <angular.IRequestShortcutConfig> {
                    params: {
                        lat: latLng.lat,
                        lon: latLng.lng
                    }
                }).success((northEast: INorthEast) => {
                    $scope.itmCoordinates = northEast;
                });
            });
        }
    }
} 