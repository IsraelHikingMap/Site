module IsraelHiking.Controllers {
    export interface IInfoHelpScope extends angular.IScope {
        toggleInfo(e: Event): void;
        toggleHelp(e: Event): void;
        getState(): string;
        getLegendImage(): string;
    }

    export class InfoHelpController extends BaseMapController {

        constructor($scope: IInfoHelpScope,
            sidebarService: Services.SidebarService,
            mapService: Services.MapService,
            layersService: Services.LayersService) {
            super(mapService);
            $scope.toggleInfo = (e: Event) => {
                sidebarService.toggle("info", $scope);
                this.suppressEvents(e);
            };

            $scope.toggleHelp = (e: Event) => {
                sidebarService.toggle("help", $scope);
                this.suppressEvents(e);
            }

            $scope.getState = (): string => {
                return sidebarService.currentDirective;
            }

            $scope.getLegendImage = () => {
                return layersService.selectedBaseLayer.key === Services.LayersService.ISRAEL_MTB_MAP ?
                    "/content/images/legend_mtb.png" :
                    "/content/images/legend.png";
            }
        }
    }

}  