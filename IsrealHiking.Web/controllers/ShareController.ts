module IsraelHiking.Controllers {

    interface IShortUrl {
        Id: string;
        FullUrl: string;
        ModifyKey: string;
    }

    export interface IShareScope extends angular.IScope {
        openShare(e: Event);
        shareAddress: string;
        width: number;
        height: number;
        embedText: string;
        updateToken: string;
        isShareOpen(): boolean;
        updateEmbedText(width: number, height: number): void;
        createShortUrl(): void;
        updateShortUrl(updateToken: string): void;

    }

    export class ShareController extends BaseMapControllerWithToolTip {
        private shareToolTip;

        constructor($scope: IShareScope,
            $tooltip,
            $http: angular.IHttpService,
            mapService: Services.MapService,
            hashService: Services.HashService,
            toastr: Toastr) {
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

            $scope.createShortUrl = () => {
                var shortUrl = <IShortUrl>{
                    FullUrl: this.getShareAddress(),
                };
                $http.post(Common.Urls.shortUrl, shortUrl).success((shortUrl: IShortUrl) => {
                    $scope.updateToken = shortUrl.ModifyKey;
                    $scope.shareAddress = this.getShortUrl(shortUrl.Id);
                    $scope.embedText = this.getEmbedText($scope);
                }).error(() => {
                    toastr.error("Unable to generate short URL, please try again later...");
                });
            }

            $scope.updateShortUrl = (updateToken: string) => {
                var shortUrl = <IShortUrl>{
                    FullUrl: this.getShareAddress(),
                    ModifyKey: updateToken,
                };
                $http.put(Common.Urls.shortUrl + updateToken, shortUrl).success((shortUrl: IShortUrl) => {
                    $scope.shareAddress = this.getShortUrl(shortUrl.Id);
                    $scope.embedText = this.getEmbedText($scope);
                    toastr.success("Short url has been updated");
                }).error(() => {
                    toastr.error("Unable to update short URL, please try again later...");
                });
            }
        }

        private getShareAddress = () => {
            return window.location.href;
        }

        private getEmbedText = ($scope: IShareScope) => {
            return "<iframe src='" + $scope.shareAddress + "' width='" + $scope.width + "' height='" + $scope.height + "' frameborder='0' scrolling='no' />";
        }

        private getShortUrl = (id: string) => {
            return Common.Urls.getShotUrl + id;
        }
    }
}