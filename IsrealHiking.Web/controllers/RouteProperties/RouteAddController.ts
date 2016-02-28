module IsraelHiking.Controllers.RouteProperties {
    export interface IRouteAddScope extends IRouteBaseScope {

    }

    export class RouteAddController extends RouteBaseController {
        constructor($scope: IRouteAddScope,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            toastr: Toastr) {
            super($scope, mapService);
            var options = layersService.createPathOptions();
            $scope.name = layersService.createRouteName();
            $scope.isNew = true;
            $scope.weight = options.weight;
            $scope.color = _.find(Common.Constants.COLORS, c => c.value === options.color);

            $scope.saveRoute = (name: string, weight: number, e: Event) => {
                if (layersService.isNameAvailable(name) === false) {
                    toastr.error("The route name is already in use, please select another name.", "Route Name");
                    this.suppressEvents(e);
                    return;
                }
                layersService.addRoute(name, null, {
                    color: $scope.color.value,
                    weight: $scope.weight
                } as L.PathOptions);
                this.suppressEvents(e);
            }

        }
    }
}