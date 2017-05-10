namespace IsraelHiking.Controllers.MarkerPopup {
    export interface INorthEast {
        north: number;
        east: number;
    }

    export interface IRemovableMarkerScope extends IRootScope {
        title: string;
        remove(): void;
        latLng: L.LatLng;
        elevation: number;
        itmCoordinates: INorthEast;
        isSaveTooltipOpen: boolean;
        isRemoveTooltipOpen: boolean;
        wikiCoordinatesString: string;
        marker: Common.IMarkerWithTitle;
        updateWikiCoordinates(title: string): void;
    }

    export class MarkerPopupController {
        constructor($scope: IRemovableMarkerScope,
            $http: angular.IHttpService,
            elevationProvider: Services.Elevation.ElevationProvider) {
            $scope.title = $scope.marker.title;
            $scope.isRemoveTooltipOpen = false;
            $scope.isSaveTooltipOpen = false;

            $scope.marker.on("popupopen", () => {
                $scope.latLng = $scope.marker.getLatLng();
                $scope.latLng.alt = 0;
                $http.get(Common.Urls.itmGrid, {
                    params: {
                        lat: $scope.latLng.lat,
                        lon: $scope.latLng.lng
                    }
                } as angular.IRequestShortcutConfig).then((northEast: { data: INorthEast }) => {
                    $scope.itmCoordinates = northEast.data;
                });
                let array = [$scope.latLng];
                elevationProvider.updateHeights(array).then(() => $scope.latLng = array[0]);
            });

            $scope.marker.on("popupclose", () => {
                // workaround to fix issue with tooltips remaining after close.
                $scope.isRemoveTooltipOpen = false;
                $scope.isSaveTooltipOpen = false;
            });
        }
    }
} 