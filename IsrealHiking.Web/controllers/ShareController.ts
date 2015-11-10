module IsraelHiking.Controllers {

    export interface IShareScope extends angular.IScope {
        title: string;
        shareAddress: string;
        width: number;
        height: number;
        size: string;
        embedText: string;
        updateToken: string;
        isLoading: boolean;
        openShare(e: Event);
        updateEmbedText(width: number, height: number): void;
        generateUrl(): void;
        clearShareAddress(): void;
        setSize(size: string): void;
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
            $scope.width = 400;
            $scope.height = 300;
            $scope.size = "Small";
            $scope.isLoading = false;
            $scope.shareAddress = "";
            
            this.shareModal = $modal({
                title: "Share Your Work",
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
                $scope.isLoading = true;
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
                }).finally(() => {
                    $scope.isLoading = false;
                });
            }

            $scope.clearShareAddress = () => {
                $scope.shareAddress = "";
            }

            $scope.setSize = (size: string) => {
                switch (size) {
                    case "Small":
                        $scope.width = 400;
                        $scope.height = 300;
                        break;
                    case "Medium": 
                        $scope.width = 600;
                        $scope.height = 450;
                        break;
                    case "Large":
                        $scope.width = 800;
                        $scope.height = 600;
                        break;
                }
                $scope.embedText = this.getEmbedText($scope);
            }
        }

        private getEmbedText = ($scope: IShareScope) => {
            var shareAddress = $scope.shareAddress || window.location.href;
            return "<iframe src='" + shareAddress + "' width='" + $scope.width + "' height='" + $scope.height + "' frameborder='0' scrolling='no' />";
        }

        private getShareAddress = (id: string) => {
            var center = this.map.getCenter();
            var zoom = this.map.getZoom();
            return Common.Urls.apiBase + "#/?s=" + id;
        }
    }
}