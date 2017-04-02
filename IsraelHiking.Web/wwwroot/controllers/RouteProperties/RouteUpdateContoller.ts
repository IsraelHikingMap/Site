namespace IsraelHiking.Controllers.RouteProperties {
    export interface IRouteUpdateScope extends IRouteBaseScope {
        name: string;
        isReversed: boolean;
        moveToRoute(e: Event): void;
        deleteRoute(e: Event): void;
        reverseRoute(e: Event): void;
        saveRouteToFile(e: Event);
        toggleRoutingPerPoint(e: Event): void;
        getRoutingTypeImage(): void;
    }

    export class RouteUpdateController extends RouteBaseController {

        constructor($scope: IRouteUpdateScope,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            fileService: Services.FileService,
            fitBoundsService: Services.FitBoundService,
            toastr: Toastr) {
            super($scope, localStorageService, mapService);
            let routeLayer = layersService.getRouteByName($scope.name);
            $scope.routeProperties = angular.copy(routeLayer.getRouteProperties());
            $scope.isNew = false;
            $scope.isReversed = false;
            $scope.title = $scope.resources.routeProperties;

            $scope.saveRoute = (e: Event) => {
                if ($scope.routeProperties.name !== routeLayer.getRouteProperties().name && layersService.isNameAvailable($scope.routeProperties.name) === false) {
                    toastr.error($scope.resources.routeNameAlreadyInUse);
                } 
                if ($scope.routeProperties.isVisible !== routeLayer.getRouteProperties().isVisible) {
                    layersService.changeRouteState(routeLayer);
                }
                if ($scope.isReversed) {
                    routeLayer.reverse();
                }
                this.updateLocalStorage($scope, localStorageService);
                routeLayer.setRouteProperties($scope.routeProperties);
                this.suppressEvents(e);
            }
            $scope.deleteRoute = (e: Event) => {
                layersService.removeRoute(routeLayer.getRouteProperties().name);
                this.suppressEvents(e);
            }
            $scope.saveRouteToFile = (e: Event): void => {
                var data = {
                    routes: [routeLayer.getData()]
                } as Common.DataContainer;
                fileService.saveToFile($scope.routeProperties.name + ".gpx", "gpx", data)
                    .then(() => {}, () => {
                        toastr.error($scope.resources.unableToSaveToFile);
                    });
                this.suppressEvents(e);
            }

            $scope.moveToRoute = (e: Event) => {
                if (routeLayer.getData().segments.length === 0) {
                    toastr.error($scope.resources.pleaseAddPointsToRoute);
                    return;
                }
                if (!$scope.routeProperties.isVisible) {
                    toastr.warning($scope.resources.routeIsHidden);
                }
                let bounds = routeLayer.getBounds();
                if (bounds != null)
                {
                    fitBoundsService.fitBounds(bounds);
                }
                this.suppressEvents(e);
            }

            $scope.getRoutingTypeImage = () => {
                return $scope.routeProperties.isRoutingPerPoint
                    ? "/content/images/routing-per-point.png"
                    : "/content/images/routing-all.png";
            }
        }
    }
}