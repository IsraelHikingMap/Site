module IsraelHiking.Controllers {
    export interface IRouteUpdateScope extends IRouteBaseScope {
        isVisible: boolean;
        toggleVisibility(e: Event): void;
        deleteRoute(e: Event): void;
        saveRouteToFile(type: string, e: Event): void;
        reverseRoute(e: Event): void;
    }

    export class RouteUpdateController extends RouteBaseController {

        constructor($scope: IRouteUpdateScope,
            layersService: Services.LayersService,
            name: string) {
            super($scope, layersService);
            var route = layersService.getRouteByName(name);
            var options = route.getPathOptions();
            $scope.name = name;
            $scope.isNew = false;
            $scope.weight = options.weight;
            $scope.color = options.color;
            $scope.isVisible = route.state != Services.Drawing.DrawingState.hidden;
            
            $scope.toggleVisibility = () => {
                $scope.isVisible = !$scope.isVisible;
                if ($scope.isVisible) {
                    route.show();
                } else {
                    route.hide();
                }
            }
            $scope.saveRoute = (name: string, weight: number, e: Event) => {
                if (layersService.isNameAvailable(name) == true) {
                    route.setName(name);
                } else {
                    // HM TODO: toast? return false?
                }
                route.setPathOptions({ color: $scope.color, weight: weight });
            }
            $scope.deleteRoute = (e: Event) => {
                layersService.removeRoute(route.name);
            }
            $scope.saveRouteToFile = (type: string, e: Event) => {
                // HM TODO: change this to use links.
            }

            $scope.reverseRoute = (e: Event) => {
                route.reverse();
            }
        }
    }
}