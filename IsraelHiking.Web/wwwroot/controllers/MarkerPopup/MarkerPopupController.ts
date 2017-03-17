namespace IsraelHiking.Controllers.MarkerPopup {
    export interface INorthEast {
        north: number;
        east: number;
    }

    export interface IRemovableMarkerScope extends IRootScope {
        title: string;
        remove(): void;
        latLng: Common.LatLngZ;
        elevation: number;
        itmCoordinates: INorthEast;
        isSaveTooltipOpen: boolean;
        isRemoveTooltipOpen: boolean; 
        wikiCoordinatesString: string;
        marker: Services.Layers.RouteLayers.IMarkerWithTitle;
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
                $scope.latLng = angular.extend({z: 0}, $scope.marker.getLatLng()) as Common.LatLngZ;
                $http.get(Common.Urls.itmGrid, {
                    params: {
                        lat: $scope.latLng.lat,
                        lon: $scope.latLng.lng
                    }
                } as angular.IRequestShortcutConfig).success((northEast: INorthEast) => {
                    $scope.itmCoordinates = northEast;
                });
                elevationProvider.updateHeights([$scope.latLng]);
            });

            $scope.marker.on("popupclose", () => {
                // workaround to fix issue with tooltips remaining after close.
                $scope.isRemoveTooltipOpen = false; 
                $scope.isSaveTooltipOpen = false;
            });
        }
    }
} 