module IsraelHiking.Controllers {
    export interface INorthEast {
        North: number;
        East: number;
    }

    export interface IMarkerPopupScope extends angular.IScope {
        title: string;
        itmCoordinates: INorthEast;
        marker: Services.Layers.RouteLayers.IMarkerWithTitle;
        routeLayer: Services.Layers.RouteLayers.RouteLayer;
        inRoute: boolean;
        latLng: L.LatLng;
        wikiCoordinatesString: string;
        setTitle(title: string): void;
        updateWikiCoordinates(title: string): void;
        remove(): void;
    }

    export class MarkerPopupController {
        constructor($scope: IMarkerPopupScope,
            $http: angular.IHttpService) {

            $scope.title = $scope.marker.title;

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

            $scope.setTitle = (newTitle: string) => {
                if ($scope.inRoute) {
                    let segment = _.find($scope.routeLayer.route.segments, segmentToFind => segmentToFind.routePointMarker === $scope.marker);
                    segment.routePoint.title = newTitle;
                } else {
                    let routeMarker = _.find($scope.routeLayer.route.markers, markerToFind => markerToFind.marker === $scope.marker);
                    routeMarker.title = newTitle;
                }
                $scope.marker.updateLabelContent(newTitle);
                $scope.marker.title = newTitle;
                if (!newTitle) {
                    $scope.marker.hideLabel();
                } else {
                    $scope.marker.showLabel();
                }
                $scope.routeLayer.dataChanged();
                $scope.marker.closePopup();
            }
        }

        private getWikiCoordString(latlng: L.LatLng, title: string): string {
            return `{{Coord|${latlng.lat.toFixed(4)}|${latlng.lng.toFixed(4)}|display=${title}|type:landmark}}`;
        }
    }
} 