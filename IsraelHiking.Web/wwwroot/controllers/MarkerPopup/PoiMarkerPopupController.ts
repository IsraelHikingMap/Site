namespace IsraelHiking.Controllers.MarkerPopup {

    interface IIconsGroup {
        icons: string[];
    }

    export interface IPoiMarkerPopupScope extends IRemovableMarkerScope {
        wikiCoordinatesString: string;
        markerType: string;
        routeLayer: Services.Layers.RouteLayers.RouteLayer;
        iconsGroups: IIconsGroup[];
        save(title: string, markerType: string): void;
        setMerkerType(markerType: string): void;
        getDirection(title: string): string;
        updateWikiCoordinates(title: string): void;
    }

    export class PoiMarkerPopupController extends MarkerPopupController {
        constructor($scope: IPoiMarkerPopupScope,
            $http: angular.IHttpService,
            elevationProvider: Services.Elevation.ElevationProvider) {
            super($scope, $http, elevationProvider);

            let routeMarker = _.find($scope.routeLayer.route.markers, markerToFind => markerToFind.marker === $scope.marker);
            $scope.markerType = routeMarker.type || "star";
            $scope.iconsGroups = [];
            $scope.iconsGroups.push({
                icons: ["car", "bike", "hike", "four-by-four"]
            });
            $scope.iconsGroups.push({
                icons: ["arrow-left", "arrow-right", "tint", "star"]
            });
            $scope.iconsGroups.push({
                icons: ["bed", "binoculars", "fire", "flag"]
            });
            $scope.iconsGroups.push({
                icons: ["coffee", "cutlery", "shopping-cart", "tree"]
            });

            $scope.marker.on("popupopen", () => {
                $scope.wikiCoordinatesString = this.getWikiCoordString($scope.latLng, $scope.marker.title);
                $scope.markerType = routeMarker.type || "star";
            });

            $scope.marker.on("popupclose", () => {
                let routeMarker = _.find($scope.routeLayer.route.markers, markerToFind => markerToFind.marker === $scope.marker);
                let color = $scope.routeLayer.getRouteProperties().pathOptions.color;
                $scope.marker.setIcon(Services.IconsService.createMarkerIconWithColorAndType(color, routeMarker.type));
            });

            $scope.updateWikiCoordinates = (title: string) => {
                $scope.wikiCoordinatesString = this.getWikiCoordString($scope.latLng, title);
            };

            $scope.setMerkerType = (markerType: string): void => {
                $scope.markerType = markerType;
                let color = $scope.routeLayer.getRouteProperties().pathOptions.color;
                $scope.marker.setIcon(Services.IconsService.createMarkerIconWithColorAndType(color, markerType));
            }

            $scope.save = (newTitle: string, markerType: string) => {
                let routeMarker = _.find($scope.routeLayer.route.markers, markerToFind => markerToFind.marker === $scope.marker);
                routeMarker.title = newTitle;
                routeMarker.type = markerType;
                let color = $scope.routeLayer.getRouteProperties().pathOptions.color;
                Services.MapService.setMarkerTitle($scope.marker, newTitle, color);
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