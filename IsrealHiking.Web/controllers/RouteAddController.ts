module IsraelHiking.Controllers {
    export interface IRouteAddScope extends IRouteBaseScope {

    }

    export class RouteAddController extends RouteBaseController {
        constructor($scope: IRouteAddScope,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            toastr: Toastr) {
            super($scope, mapService, layersService);
            var options = layersService.createPathOptions();
            $scope.name = layersService.createRouteName();
            $scope.isNew = true;
            $scope.weight = options.weight;
            $scope.color = options.color;

            $scope.saveRoute = (name: string, weight: number, e: Event) => {
                if (layersService.isNameAvailable(name) == false) {
                    toastr.error("The route name is already in use, please select another name.", "Route Name");
                    this.suppressEvents(e);
                    return;
                }
                layersService.addRoute(name, null, <L.PathOptions> {
                    color: $scope.color,
                    weight: $scope.weight,
                });
                this.suppressEvents(e);
            }

        }
    }
}