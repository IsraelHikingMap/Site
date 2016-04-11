module IsraelHiking.Controllers {
    export interface INorthEast {
        North: number;
        East: number;
    }

    export interface IMarkerPopupScope extends angular.IScope {
        title: string;
        itmCoordinates: INorthEast;
        marker: Services.Drawing.IMarkerWithTitle;
        latLng: L.LatLng;
        wikiCoordinatesString: string;
        setTitle(title: string): void;
        updateWikiCoordinates(title: string): void;
    }

    export class MarkerPopupController {
        constructor($scope: IMarkerPopupScope,
            $http: angular.IHttpService) {
            $scope.marker.on("popupopen", () => {
                $scope.latLng = $scope.marker.getLatLng();
                $scope.wikiCoordinatesString = this.getWikiCoordString($scope.latLng, $scope.marker.title);
                $http.get(Common.Urls.itmGrid, {
                    params: {
                        lat: $scope.latLng.lat,
                        lon: $scope.latLng.lng
                    }
                } as angular.IRequestShortcutConfig).success((northEast: INorthEast) => {
                    $scope.itmCoordinates = northEast;
                });
            });

            $scope.updateWikiCoordinates = (title: string) =>
            {
                $scope.wikiCoordinatesString = this.getWikiCoordString($scope.latLng, title);
            };
        }

        private getWikiCoordString(latlng: L.LatLng, title: string): string {
            return `{{Coord|${latlng.lat.toFixed(4)}|${latlng.lng.toFixed(4)}|display=${title}|type:landmark}}`;
        }
    }
} 