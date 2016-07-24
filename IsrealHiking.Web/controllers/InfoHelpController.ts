namespace IsraelHiking.Controllers {
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
            layersService: Services.Layers.LayersService) {
            super(mapService);
            $scope.toggleInfo = (e: Event) => {
                sidebarService.toggle("info");
                this.suppressEvents(e);
            };

            $scope.toggleHelp = (e: Event) => {
                sidebarService.toggle("help");
                this.suppressEvents(e);
            }

            $scope.getState = (): string => {
                return sidebarService.viewName;
            }

            $scope.getLegendImage = () => {
                return layersService.selectedBaseLayer.key === Services.Layers.LayersService.ISRAEL_MTB_MAP ?
                    "/content/images/legend_mtb.png" :
                    "/content/images/legend.png";
            }
        }
    }

}  