module IsraelHiking.Controllers {
    export interface IInfoHelpScope extends angular.IScope {
        openInfo(e: Event): void;
        openHelp(e: Event): void;
        goToLegend(): void;
        getState(): string;
        
    }


    export class InfoHelpController extends BaseMapControllerWithToolTip {
        infoTooltip;
        helpTooltip;

        constructor($scope: IInfoHelpScope,
            mapService: Services.MapService,
            $tooltip) {
            super(mapService, $tooltip);
            this.$tooltip = $tooltip;
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
                    this.helpTooltip = this.createToolTip(e.target, "views/templates/helpTooltip.tpl.html", "help", $scope);
                    this.helpTooltip.$promise.then(this.helpTooltip.show);
                }
                if (this.infoTooltip) {
                    this.infoTooltip.hide();
                }
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
            }

            $scope.goToLegend = () => {
                this.map.setZoom(14);
                setTimeout(() => {
                    this.map.panTo(new L.LatLng(32.8185, 35.5707));
                    // HM TODO: work around for zoom issue - remove when leaflet has a fixed?
                }, 1000);
                this.infoTooltip.hide();
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
        }
    }

}  