namespace IsraelHiking.Controllers.RouteProperties {
    export interface IRouteBaseScope extends IRootScope {
        routeProperties: Services.Layers.RouteLayers.IRouteProperties;
        colors: { key: string, value: string }[];
        isNew: boolean;
        title: string;
        getColorName(colorValue: string): string;
        saveRoute(e: Event);
    }

    export class RouteBaseController extends BaseMapController {
        constructor($scope: IRouteBaseScope,
            mapService: Services.MapService) {
            super(mapService);
            $scope.colors = Services.Layers.RouteLayers.RouteLayerFactory.COLORS;

            $scope.getColorName = (colorValue: string): string => {
                return _.find(Services.Layers.RouteLayers.RouteLayerFactory.COLORS, c => c.value === colorValue).key;
            }
        }

        protected updateLocalStorage($scope: IRouteBaseScope, localStorageService: angular.local.storage.ILocalStorageService) {
            localStorageService.set(Services.Layers.RouteLayers.RouteLayerFactory.IS_ROUTING_PER_POINT_KEY, $scope.routeProperties.isRoutingPerPoint);
            localStorageService.set(Services.Layers.RouteLayers.RouteLayerFactory.ROUTE_OPACITY, $scope.routeProperties.pathOptions.opacity);
        }
    }
}