namespace IsraelHiking.Controllers.RouteProperties {
    export interface IRouteAddScope extends IRouteBaseScope {
        
    }

    export class RouteAddController extends RouteBaseController {
        constructor($scope: IRouteAddScope,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            routeLayerFactory: Services.Layers.RouteLayers.RouteLayerFactory,
            toastr: Toastr) {
            super($scope, localStorageService, mapService);
            $scope.routeProperties = routeLayerFactory.createRoute(layersService.createRouteName()).properties;
            $scope.isNew = true;
            $scope.title = $scope.resources.addRoute;

            $scope.saveRoute = (e: Event) => {
                if (layersService.isNameAvailable($scope.routeProperties.name) === false) {
                    toastr.error($scope.resources.routeNameAlreadyInUse);
                    this.suppressEvents(e);
                    return;
                }
                this.updateLocalStorage($scope, localStorageService);
                layersService.addRoute({ properties: $scope.routeProperties, segments: [], markers: []});
                this.suppressEvents(e);
            }

        }
    }
}