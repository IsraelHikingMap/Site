module IsraelHiking.Controllers {
    export interface IRouteBaseScope extends angular.IScope {
        name: string;
        weight: number;
        color: string;
        colors: string[];
        isNew: boolean;
        setColor(color: string, e: Event);
        saveRoute(name: string, weight: number, e: Event);
    }

    export class RouteBaseController extends BaseMapController {
        constructor($scope: IRouteBaseScope,
            mapService: Services.MapService,
            layersService: Services.LayersService) {
            super(mapService);
            $scope.colors = Common.Constants.COLORS;

            $scope.setColor = (color: string, e: Event) => {
                $scope.color = color;
                this.suppressEvents(e);
            }
        }
    }
}