module IsraelHiking.Controllers {
    export interface IInfoHelpScope extends angular.IScope {
        openInfo(e: Event): void;
        openHelp(e: Event): void;
        openLegend(): void;
        getState(): string;
        getLegendImage(): string;
    }

    export class InfoHelpController extends BaseMapControllerWithToolTip {
        infoTooltip;
        helpTooltip;
        legendModal;

        constructor($scope: IInfoHelpScope,
            $tooltip,
            $modal,
            mapService: Services.MapService,
            layersService: Services.LayersService) {
            super(mapService, $tooltip);
            this.legendModal = $modal({
                title: "Legend",
                templateUrl: "views/templates/legendModal.tpl.html",
                show: false,
                scope: $scope,
            });
            $scope.openInfo = (e: Event) => {
                if (this.infoTooltip == null) {
                    this.infoTooltip = this.createToolTip(e.target, "views/templates/infoTooltip.tpl.html", "Info", $scope);
                    this.infoTooltip.$promise.then(this.infoTooltip.show);
                }
                if (this.helpTooltip) {
                    this.helpTooltip.hide();
                }
                this.suppressEvents(e);
            };

            $scope.openHelp = (e: Event) => {
                if (this.helpTooltip == null) {
                    this.helpTooltip = this.createToolTip(e.target, "views/templates/helpTooltip.tpl.html", "Help", $scope);
                    this.helpTooltip.$promise.then(this.helpTooltip.show);
                }
                if (this.infoTooltip) {
                    this.infoTooltip.hide();
                }
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
            }

            $scope.openLegend = () => {
                this.legendModal.show();
                this.helpTooltip.hide();
            }

            $scope.getState = (): string => {
                if (this.helpTooltip && this.helpTooltip.$isShown) {
                    return "help";
                }
                if (this.infoTooltip && this.infoTooltip.$isShown) {
                    return "info";
                }
                return "none";
            }

            $scope.getLegendImage = () => {
                return layersService.selectedBaseLayer.key == Services.LayersService.ISRAEL_MTB_MAP ?
                    "content/images/legend_mtb.png" :
                    "content/images/legend.png";
            }
        }
    }

}  