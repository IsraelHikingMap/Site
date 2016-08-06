namespace IsraelHiking.Controllers.RouteProperties {
    export interface IRouteUpdateScope extends IRouteBaseScope {
        isReversed: boolean;
        toggleVisibility(e: Event): void;
        deleteRoute(e: Event): void;
        reverseRoute(e: Event): void;
        saveRouteToFile(e: Event);
        toggleRoutingPerPoint(e: Event): void;
    }

    export class RouteUpdateController extends RouteBaseController {

        constructor($scope: IRouteUpdateScope,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            fileService: Services.FileService,
            toastr: Toastr,
            name: string) {
            super($scope, mapService);
            let routeLayer = layersService.getRouteByName(name);
            $scope.routeProperties = angular.copy(routeLayer.getRouteProperties());
            $scope.isNew = false;
            $scope.isReversed = false;

            $scope.saveRoute = (e: Event) => {
                if ($scope.routeProperties.name !== routeLayer.getRouteProperties().name && layersService.isNameAvailable($scope.routeProperties.name) === false) {
                    toastr.error("The route name is already in use, please select another name.", "Route Name");
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
                        toastr.error("Unable to save route to file...");
                    });
                this.suppressEvents(e);
            }
        }
    }
}