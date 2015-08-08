module IsraelHiking.Controllers {
    export interface IRoutePropertiesScope extends angular.IScope {
        name: string;
        originalName: string;
        weight: number;
        color: string;
        latlngz: number;
        colors: string[];
        isVisible: boolean;
        setColor(color: string);
        toggleVisibility(e: Event): void;
        saveRoute(name: string, weight: number, isVisible: boolean, e: Event);
        deleteRoute(e: Event): void;
    }

    export class RoutePropertiesController {

        constructor($scope: IRoutePropertiesScope,
            layersService: Services.LayersService,
            name?: string) {
            $scope.originalName = name || layersService.createRouteName();
            $scope.name = $scope.originalName;
            var options = layersService.getRouteViewOptions(name);
            $scope.weight = options.pathOptions.weight;
            $scope.color = options.pathOptions.color;
            $scope.isVisible = options.isVisible;

            $scope.colors = Common.Constants.COLORS;

            $scope.setColor = (color: string) => {
                $scope.color = color;
            }
            $scope.toggleVisibility = () => {
                $scope.isVisible = !$scope.isVisible;
            }
            $scope.saveRoute = (name: string, weight: number, isVisible:boolean, e: Event) => {
                layersService.addOrUpdateRouteOptions($scope.originalName, name,
                    <L.PathOptions> { color: $scope.color, weight: weight },
                    isVisible);
            }
            $scope.deleteRoute = (e: Event) => {
                layersService.removeRoute($scope.originalName);
            }
        }
    }
}