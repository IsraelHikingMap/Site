namespace IsraelHiking.Controllers.RouteProperties {
    export interface IRouteBaseScope extends IRootScope {
        routeProperties: Services.Layers.RouteLayers.IRouteProperties;
        colors: string[];
        isNew: boolean;
        isAdvanced: boolean;
        title: string;
        saveRoute(e: Event);
    }

    export class RouteBaseController extends BaseMapController {
        constructor($scope: IRouteBaseScope,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: Services.MapService) {
            super(mapService);
            $scope.colors = Services.Layers.RouteLayers.RouteLayerFactory.COLORS;
            $scope.isAdvanced = localStorageService.get(LayersController.SHOW_ADVANCED_KEY) ? true : false;
        }

        protected updateLocalStorage($scope: IRouteBaseScope, localStorageService: angular.local.storage.ILocalStorageService) {
            localStorageService.set(Services.Layers.RouteLayers.RouteLayerFactory.IS_ROUTING_PER_POINT_KEY, $scope.routeProperties.isRoutingPerPoint);
            localStorageService.set(Services.Layers.RouteLayers.RouteLayerFactory.ROUTE_OPACITY, $scope.routeProperties.pathOptions.opacity);
        }
    }
}