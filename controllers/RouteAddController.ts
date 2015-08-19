module IsraelHiking.Controllers {
    export interface IRouteAddScope extends IRouteBaseScope {

    }

    export class RouteAddController extends RouteBaseController {
        constructor($scope: IRouteAddScope,
            layersService: Services.LayersService) {
            super($scope, layersService);
            var options = layersService.createPathOptions();
            $scope.name = layersService.createRouteName();
            $scope.isNew = true;
            $scope.weight = options.weight;
            $scope.color = options.color;

            $scope.saveRoute = (name: string, weight: number, e: Event) => {
                if (layersService.isNameAvailable(name) == false) {
                    // HM TODO: toast? return false?
                    return;
                }
                layersService.addRoute(name, null, <L.PathOptions> {
                    color: $scope.color,
                    weight: $scope.weight,
                });
            }

        }
    }
}