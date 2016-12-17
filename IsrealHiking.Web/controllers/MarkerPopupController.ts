namespace IsraelHiking.Controllers {
    export interface INorthEast {
        North: number;
        East: number;
    }

    export interface IRemovableMarkerScope extends IRootScope {
        remove(): void;
        latLng: Common.LatLngZ;
        elevation: number;
        itmCoordinates: INorthEast;
        isSaveTooltipOpen: boolean;
        isRemoveTooltipOpen: boolean; 
        wikiCoordinatesString: string;
        marker: L.Marker;
        updateWikiCoordinates(title: string): void;
    }

    export interface IMarkerPopupScope extends IRemovableMarkerScope {
        title: string;
        marker: Services.Layers.RouteLayers.IMarkerWithTitle;
        routeLayer: Services.Layers.RouteLayers.RouteLayer;
        setTitle(title: string): void;
        getDirection(title: string): string;
    }

    export class MarkerPopupController {
        constructor($scope: IMarkerPopupScope,
            $http: angular.IHttpService,
            elevationProvider: Services.Elevation.ElevationProvider) {

            $scope.title = $scope.marker.title;
            $scope.isRemoveTooltipOpen = false;
            $scope.isSaveTooltipOpen = false;
            $scope.marker.on("popupopen", () => {
                $scope.latLng = angular.extend({z: 0}, $scope.marker.getLatLng()) as Common.LatLngZ;

                $scope.wikiCoordinatesString = this.getWikiCoordString($scope.latLng, $scope.marker.title);
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

            $scope.updateWikiCoordinates = (title: string) => {
                $scope.wikiCoordinatesString = this.getWikiCoordString($scope.latLng, title);
            };

            $scope.setTitle = (newTitle: string) => {
                let routeMarker = _.find($scope.routeLayer.route.markers, markerToFind => markerToFind.marker === $scope.marker);
                routeMarker.title = newTitle;
                $scope.marker.updateLabelContent($scope.routeLayer.getHtmlTitle(newTitle));
                $scope.marker.title = newTitle;
                if (!newTitle) {
                    $scope.marker.hideLabel();
                } else {
                    $scope.marker.showLabel();
                }
                $scope.routeLayer.dataChanged();
                $scope.marker.closePopup();
            }

            $scope.getDirection = (title: string) => {
                if (!title) {
                    return $scope.resources.direction;
                }
                if (title.match(/^[\u0590-\u05FF]/) != null) {
                    return "rtl";
                }
                return "ltr";
            }
        }

        private getWikiCoordString(latlng: L.LatLng, title: string): string {
            return `{{Coord|${latlng.lat.toFixed(4)}|${latlng.lng.toFixed(4)}|display=${title}|type:landmark}}`;
        }
    }
} 