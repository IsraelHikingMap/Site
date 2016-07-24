namespace IsraelHiking.Controllers.RouteProperties {
    export interface IRouteAddScope extends IRouteBaseScope {
        
    }

    export class RouteAddController extends RouteBaseController {
        constructor($scope: IRouteAddScope,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            routeLayerFactory: Services.Layers.RouteLayers.RouteLayerFactory,
            toastr: Toastr) {
            super($scope, mapService);
            $scope.routeProperties = routeLayerFactory.createRoute(layersService.createRouteName()).properties;
            $scope.isNew = true;

            $scope.saveRoute = (e: Event) => {
                if (layersService.isNameAvailable($scope.routeProperties.name) === false) {
                    toastr.error("The route name is already in use, please select another name.", "Route Name");
                    this.suppressEvents(e);
                    return;
                }
                
                layersService.addRoute({ properties: $scope.routeProperties, segments: []});
                this.suppressEvents(e);
            }

        }
    }
}