namespace IsraelHiking.Controllers.MarkerPopup {

    export interface IPoiMarkerPopupScope extends IRemovableMarkerScope {
        wikiCoordinatesString: string;
        routeLayer: Services.Layers.RouteLayers.RouteLayer;
        setTitle(title: string): void;
        getDirection(title: string): string;
        updateWikiCoordinates(title: string): void;
    }

    export class PoiMarkerPopupController extends MarkerPopupController {
        constructor($scope: IPoiMarkerPopupScope,
            $http: angular.IHttpService,
            elevationProvider: Services.Elevation.ElevationProvider) {
            super($scope, $http, elevationProvider);

            $scope.marker.on("popupopen", () => {
                $scope.wikiCoordinatesString = this.getWikiCoordString($scope.latLng, $scope.marker.title);
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