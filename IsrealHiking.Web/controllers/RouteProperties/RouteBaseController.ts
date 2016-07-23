module IsraelHiking.Controllers.RouteProperties {
    export interface IRouteBaseScope extends angular.IScope {
        routeProperties: Services.Layers.RouteLayers.IRouteProperties;
        colors: { key: string, value: string }[];
        isNew: boolean;
        getColorName(colorValue: string): string;
        saveRoute(e: Event);
    }

    export class RouteBaseController extends BaseMapController {
        constructor($scope: IRouteBaseScope,
            mapService: Services.MapService) {
            super(mapService);
            $scope.colors = Common.Constants.COLORS;

            $scope.getColorName = (colorValue: string): string => {
                return _.find(Common.Constants.COLORS, c => c.value === colorValue).key;
            }
        }
    }
}