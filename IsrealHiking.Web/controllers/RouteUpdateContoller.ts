module IsraelHiking.Controllers {
    export interface IRouteUpdateScope extends IRouteBaseScope {
        isVisible: boolean;
        isRoutingPerPoint: boolean;
        isReversed: boolean;
        toggleVisibility(e: Event): void;
        deleteRoute(e: Event): void;
        reverseRoute(e: Event): void;
        saveRouteToFile(extention: string, e: Event);
        toggleRoutingPerPoint(e: Event): void;
    }

    export class RouteUpdateController extends RouteBaseController {

        constructor($scope: IRouteUpdateScope,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            fileService: Services.FileService,
            name: string) {
            super($scope, mapService, layersService);
            var route = layersService.getRouteByName(name);
            var options = route.getPathOptions();
            var shouldReverse = false;
            $scope.name = name;
            $scope.isNew = false;
            $scope.weight = options.weight;
            $scope.color = options.color;
            $scope.isVisible = route.state != Services.Drawing.DrawingState.hidden;
            $scope.isRoutingPerPoint = route.isRoutingPerPoint;
            $scope.isReversed = false;
            $scope.toggleVisibility = (e: Event) => {
                $scope.isVisible = !$scope.isVisible;
                this.suppressEvents(e);
            }
            $scope.saveRoute = (name: string, weight: number, e: Event) => {
                if (layersService.isNameAvailable(name) == true) {
                    route.setName(name);
                } else {
                    // HM TODO: toast? return false?
                }
                if ($scope.isVisible) {
                    route.show();
                } else {
                    route.hide();
                }
                if ($scope.isReversed) {
                    route.reverse();
                }
                route.setPathOptions({ color: $scope.color, weight: weight });
                route.isRoutingPerPoint = $scope.isRoutingPerPoint;
                this.suppressEvents(e);
            }
            $scope.deleteRoute = (e: Event) => {
                layersService.removeRoute(route.name);
                this.suppressEvents(e);
            }
            $scope.saveRouteToFile = (extention: string, e: Event): void=> {
                var data = <Common.DataContainer> {
                    markers: [],
                    routes: [route.getData()]
                };
                fileService.saveToFile(route.name + "." + extention, data);
                this.suppressEvents(e);
            }

            $scope.reverseRoute = (e: Event) => {
                $scope.isReversed = !$scope.isReversed;
                this.suppressEvents(e);
            }

            $scope.toggleRoutingPerPoint = (e: Event) => {
                $scope.isRoutingPerPoint = !$scope.isRoutingPerPoint;
                this.suppressEvents(e);
            }
        }
    }
}