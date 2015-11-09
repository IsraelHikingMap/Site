module IsraelHiking.Controllers {

    export interface IShareScope extends angular.IScope {
        title: string;
        shareAddress: string;
        width: number;
        height: number;
        embedText: string;
        updateToken: string;
        openShare(e: Event);
        updateEmbedText(width: number, height: number): void;
        generateUrl(): void;
        updateUrl(updateToken: string): void;
        clearShareAddress(): void;
    }

    export class ShareController extends BaseMapController {
        private shareModal;

        constructor($scope: IShareScope,
            $modal,
            $http: angular.IHttpService,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            toastr: Toastr) {
            super(mapService);
            
            $scope.title = "";
            $scope.width = 640;
            $scope.height = 390;
            $scope.shareAddress = "";
            
            this.shareModal = $modal({
                title: "Share your work",
                templateUrl: "views/templates/shareModal.tpl.html",
                show: false,
                scope: $scope,
            });

            $scope.updateEmbedText = (width: number, height: number) => {
                $scope.width = width;
                $scope.height = height;
                $scope.embedText = this.getEmbedText($scope);
            }

            $scope.openShare = (e: Event) => {
                $scope.embedText = this.getEmbedText($scope);
                this.shareModal.$promise.then(this.shareModal.show);
                this.suppressEvents(e);
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

            $scope.clearShareAddress = () => {
                $scope.shareAddress = "";
            }
        }

        private getEmbedText = ($scope: IShareScope) => {
            var shareAddress = $scope.shareAddress || window.location.href;
            return "<iframe src='" + shareAddress + "' width='" + $scope.width + "' height='" + $scope.height + "' frameborder='0' scrolling='no' />";
        }

        private getShareAddress = (id: string) => {
            var center = this.map.getCenter();
            var zoom = this.map.getZoom();
            return Common.Urls.apiBase + "#/" + Services.HashService.getLocationAddress(zoom, center.lat, center.lng) + "?s=" + id;
        }
    }
}