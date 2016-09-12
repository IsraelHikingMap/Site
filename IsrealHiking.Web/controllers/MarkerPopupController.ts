namespace IsraelHiking.Controllers {
    export interface INorthEast {
        North: number;
        East: number;
    }

    export interface IRemovableMarkerScope extends angular.IScope {
        remove(): void;
    }

    export interface IMarkerPopupScope extends IRemovableMarkerScope {
        title: string;
        itmCoordinates: INorthEast;
        isSaveTooltipOpen: boolean;
        isRemoveTooltipOpen: boolean; 
        marker: Services.Layers.PoiLayers.IMarkerWithTitle;
        poiLayer: Services.Layers.PoiLayers.PoiLayer;
        latLng: L.LatLng;
        wikiCoordinatesString: string;
        setTitle(title: string): void;
        updateWikiCoordinates(title: string): void;
    }

    export class MarkerPopupController {
        constructor($scope: IMarkerPopupScope,
            $http: angular.IHttpService) {

            $scope.title = $scope.marker.title;
            $scope.isRemoveTooltipOpen = false;
            $scope.isSaveTooltipOpen = false;
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

            $scope.marker.on("popupclose", () => {
                // workaround to fix issue with tooltips remaining after close.
                $scope.isRemoveTooltipOpen = false; 
                $scope.isSaveTooltipOpen = false;
            });

            $scope.updateWikiCoordinates = (title: string) => {
                $scope.wikiCoordinatesString = this.getWikiCoordString($scope.latLng, title);
            };

            $scope.setTitle = (newTitle: string) => {
                let routeMarker = _.find($scope.poiLayer.markers, markerToFind => markerToFind.marker === $scope.marker);
                routeMarker.title = newTitle;
                $scope.marker.updateLabelContent(newTitle.replace(/\n/g, "<br/>"));
                $scope.marker.title = newTitle;
                if (!newTitle) {
                    $scope.marker.hideLabel();
                } else {
                    $scope.marker.showLabel();
                }
                $scope.poiLayer.dataChanged();
                $scope.marker.closePopup();
            }
        }

        private getWikiCoordString(latlng: L.LatLng, title: string): string {
            return `{{Coord|${latlng.lat.toFixed(4)}|${latlng.lng.toFixed(4)}|display=${title}|type:landmark}}`;
        }
    }
} 