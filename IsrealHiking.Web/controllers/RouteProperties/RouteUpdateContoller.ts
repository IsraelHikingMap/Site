module IsraelHiking.Controllers.RouteProperties {
    export interface IRouteUpdateScope extends IRouteBaseScope {
        isVisible: boolean;
        isRoutingPerPoint: boolean;
        isReversed: boolean;
        toggleVisibility(e: Event): void;
        deleteRoute(e: Event): void;
        reverseRoute(e: Event): void;
        saveRouteToFile(e: Event);
        toggleRoutingPerPoint(e: Event): void;
    }

    export class RouteUpdateController extends RouteBaseController {

        constructor($scope: IRouteUpdateScope,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            fileService: Services.FileService,
            toastr: Toastr,
            name: string) {
            super($scope, mapService);
            var route = layersService.getRouteByName(name);
            var options = route.getPathOptions();
            $scope.name = name;
            $scope.isNew = false;
            $scope.weight = options.weight;
            $scope.color = _.find(Common.Constants.COLORS, c => c.value === options.color);
            $scope.isVisible = route.state !== Services.Drawing.DrawingState.hidden;
            $scope.isRoutingPerPoint = route.isRoutingPerPoint;
            $scope.isReversed = false;
            $scope.toggleVisibility = (e: Event) => {
                $scope.isVisible = !$scope.isVisible;
                this.suppressEvents(e);
            }
            $scope.saveRoute = (newName: string, weight: number, e: Event) => {
                if (newName !== route.name && layersService.isNameAvailable(newName)) {
                    route.setName(newName);
                } else if (newName !== route.name && layersService.isNameAvailable(newName) === false) {
                    toastr.error("The route name is already in use, please select another name.", "Route Name");
                }
                if ($scope.isVisible && route.state === Services.Drawing.DrawingState.hidden) {
                    route.changeStateTo(Services.Drawing.DrawingState.inactive);
                } else if ($scope.isVisible === false) {
                    route.changeStateTo(Services.Drawing.DrawingState.hidden);
                }
                if ($scope.isReversed) {
                    route.reverse();
                }
                route.setPathOptions({ color: $scope.color.value, weight: weight } as L.PathOptions);
                route.isRoutingPerPoint = $scope.isRoutingPerPoint;
                this.suppressEvents(e);
            }
            $scope.deleteRoute = (e: Event) => {
                layersService.removeRoute(route.name);
                this.suppressEvents(e);
            }
            $scope.saveRouteToFile = (e: Event): void=> {
                var data = {
                    markers: [],
                    routes: [route.getData()]
                } as Common.DataContainer;
                fileService.saveToFile(route.name + ".gpx", data)
                    .then(() => {}, () => {
                        toastr.error("Unable to save route to file...");
                    });
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