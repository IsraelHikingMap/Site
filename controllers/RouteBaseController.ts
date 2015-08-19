module IsraelHiking.Controllers {
    export interface IRouteBaseScope extends angular.IScope {
        name: string;
        weight: number;
        color: string;
        colors: string[];
        isNew: boolean;
        setColor(color: string);
        saveRoute(name: string, weight: number, e: Event);
    }

    export class RouteBaseController {
        constructor($scope: IRouteBaseScope,
            layersService: Services.LayersService) {

            $scope.colors = Common.Constants.COLORS;

            $scope.setColor = (color: string) => {
                $scope.color = color;
            }
        }
    }
}