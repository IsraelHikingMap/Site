module IsraelHiking.Controllers {

    export interface IShareScope extends angular.IScope {
        title: string;
        shareAddress: string;
        width: number;
        height: number;
        embedText: string;
        updateToken: string;
        isShareOpen(): boolean;
        openShare(e: Event);
        updateEmbedText(width: number, height: number): void;
        generateUrl(): void;
        updateUrl(updateToken: string): void;
    }

    export class ShareController extends BaseMapControllerWithToolTip {
        private shareToolTip;

        constructor($scope: IShareScope,
            $tooltip,
            $http: angular.IHttpService,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            toastr: Toastr) {
            super(mapService, $tooltip);
            this.shareToolTip = null;
            $scope.title = "";
            $scope.width = 640;
            $scope.height = 390;
            $scope.shareAddress = "";
            

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
                $scope.embedText = this.getEmbedText($scope);
                this.suppressEvents(e);
            }

            $scope.isShareOpen = () => {
                return this.shareToolTip != null && this.shareToolTip.$isShown;
            }

            $scope.generateUrl = () => {
                var siteUrl = <Common.SiteUrl>{
                    Title: $scope.title,
                    JsonData: JSON.stringify(layersService.getData()),
                };
                $http.post(Common.Urls.urls, siteUrl).success((siteUrlResponse: Common.SiteUrl) => {
                    $scope.updateToken = siteUrlResponse.ModifyKey;
                    $scope.shareAddress = this.getShareAddress(siteUrlResponse.Id);
                    $scope.embedText = this.getEmbedText($scope);
                }).error(() => {
                    toastr.error("Unable to generate URL, please try again later...");
                });
            }

            $scope.updateUrl = (updateToken: string) => {
                var siteUrl = <Common.SiteUrl>{
                    Title: $scope.title,
                    JsonData: JSON.stringify(layersService.getData()),
                    ModifyKey: updateToken,
                };
                $http.put(Common.Urls.urls + updateToken, siteUrl).success((siteUrlResponse: Common.SiteUrl) => {
                    $scope.shareAddress = this.getShareAddress(siteUrlResponse.Id);
                    $scope.embedText = this.getEmbedText($scope);
                    toastr.success("Data has been updated");
                }).error(() => {
                    toastr.error("Unable to update data, please try again later...");
                });
            }
        }

        private getEmbedText = ($scope: IShareScope) => {
            var shareAddress = $scope.shareAddress || window.location.href;
            return "<iframe src='" + shareAddress + "' width='" + $scope.width + "' height='" + $scope.height + "' frameborder='0' scrolling='no' />";
        }

        private getShareAddress = (id: string) => {
            return Common.Urls.apiBase + "#/?s=" + id;
        }
    }
}