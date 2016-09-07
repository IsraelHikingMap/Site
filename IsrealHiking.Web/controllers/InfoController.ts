namespace IsraelHiking.Controllers {
    type InfoState = "legend" | "help" | "about";

    export interface IInfoHelpScope extends angular.IScope {
        state: InfoState;
        toggleInfo(e: Event): void;
        isActive(): boolean;
        getLegendImage(): string;
    }

    export class InfoController extends BaseMapController {

        constructor($scope: IInfoHelpScope,
            sidebarService: Services.SidebarService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService) {
            super(mapService);

            $scope.state = "legend";

            $scope.toggleInfo = (e: Event) => {
                sidebarService.toggle("info");
                this.suppressEvents(e);
            };

            $scope.isActive = (): boolean => {
                return sidebarService.viewName === "info";
            }

            $scope.getLegendImage = () => {
                return layersService.selectedBaseLayer.key === Services.Layers.LayersService.ISRAEL_MTB_MAP ?
                    "/mtbtiles/legend.png" :
                    "/tiles/legend.png";
            }
        }
    }

}  