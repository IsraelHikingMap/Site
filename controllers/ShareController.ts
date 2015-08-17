module IsraelHiking.Controllers {
    export interface IShareScope extends angular.IScope {
        openShare(e: Event);
        shareAddress: string;
        width: number;
        height: number;
        embedText: string;
        isShareOpen(): boolean;
        updateEmbedText(width: number, height: number): void;

    }

    export class ShareController extends BaseMapControllerWithToolTip {
        private shareToolTip;

        constructor($scope: IShareScope,
            $tooltip,
            mapService: Services.MapService,
            hashService: Services.HashService) {
            super(mapService, $tooltip);
            this.shareToolTip = null;
            $scope.width = 640;
            $scope.height = 390;

            $scope.updateEmbedText = (width: number, height: number) => {
                $scope.width = width;
                $scope.height = height;
                $scope.embedText = this.getEmbedText($scope);
            }

            $scope.openShare = (e: Event) => {
                if (this.shareToolTip == null) {
                    this.shareToolTip = this.createToolTip(e.target, "views/templates/shareTooltip.tpl.html", "Share", $scope, "left");
                    this.shareToolTip.$promise.then(this.shareToolTip.show);
                }
                $scope.shareAddress = this.getShareAddress();
                $scope.embedText = this.getEmbedText($scope);
                this.suppressEvents(e);
            }

            $scope.isShareOpen = () => {
                return this.shareToolTip != null && this.shareToolTip.$isShown;
            }
        }

        private getShareAddress = () => {
            return window.location.href;
        }

        private getEmbedText = ($scope: IShareScope) => {
            return "<iframe src='" + $scope.shareAddress + "' width='" + $scope.width + "' height='" + $scope.height + "' frameborder='0' scrolling='no' />";
        }
    }
}