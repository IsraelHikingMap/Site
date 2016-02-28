module IsraelHiking.Controllers.RouteProperties {
    export interface IRouteBaseScope extends angular.IScope {
        name: string;
        weight: number;
        color: { key: string, value: string };
        colors: {key: string, value: string}[];
        isNew: boolean;
        setColor(color: { key: string, value: string }, e: Event);
        saveRoute(name: string, weight: number, e: Event);
    }

    export class RouteBaseController extends BaseMapController {
        constructor($scope: IRouteBaseScope,
            mapService: Services.MapService) {
            super(mapService);
            $scope.colors = Common.Constants.COLORS;

            $scope.setColor = (color: { key: string, value: string }, e: Event) => {
                $scope.color = color;
                this.suppressEvents(e);
            }
        }
    }
}