namespace IsraelHiking.Controllers {

    export interface IIOffroadCoordinates {
        latitude: number;
        longitude: number;
        altitude: number;
    }

    export interface IOffroadPostRequest {
        userMail: string;
        activityType: string;
        title: string;
        description: string;
        sharingCode: number; //should be 5 fixed
        path: IIOffroadCoordinates[];
    }

    export interface IShareScope extends IRootScope {
        title: string;
        imageUrl: string;
        shareAddress: string;
        whatappShareAddress: string;
        facebookShareAddress: string;
        width: number;
        height: number;
        size: string;
        embedText: string;
        isLoading: boolean;
        siteUrlId: string;
        openShare(e: Event);
        updateEmbedText(width: number, height: number): void;
        generateUrl(title: string, description: string): void;
        clearShareAddress(): void;
        setSize(size: string): void;
        sendToOffroad(userMail: string, title: string, description: string): void;
    }

    export class ShareController extends BaseMapController {
        private $window: angular.IWindowService;
        private osmUserService: Services.OsmUserService;

        constructor($scope: IShareScope,
            $uibModal: angular.ui.bootstrap.IModalService,
            $http: angular.IHttpService,
            $window: angular.IWindowService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            osmUserService: Services.OsmUserService,
            toastr: Toastr) {
            super(mapService);

            this.$window = $window;
            this.osmUserService = osmUserService;
            $scope.title = "";
            $scope.width = 400;
            $scope.height = 300;
            $scope.size = $scope.resources.small;
            $scope.isLoading = false;

            $scope.clearShareAddress = () => {
                $scope.shareAddress = "";
                $scope.whatappShareAddress = "";
                $scope.facebookShareAddress = "";
                $scope.siteUrlId = "";
            }

            $scope.clearShareAddress();

            $scope.updateEmbedText = (width: number, height: number) => {
                $scope.width = width;
                $scope.height = height;
                $scope.embedText = this.getEmbedText($scope);
            }

            $scope.openShare = (e: Event) => {
                $scope.embedText = this.getEmbedText($scope);
                $scope.title = layersService.getSelectedRoute() == null
                    ? ""
                    : layersService.getSelectedRoute().getData().name;
                $uibModal.open({
                    templateUrl: "controllers/shareModal.html",
                    scope: $scope
                });
                this.suppressEvents(e);
            }

            $scope.generateUrl = (title: string, description: string) => {
                $scope.isLoading = true;
                var siteUrl = {
                    Title: title,
                    Description: description,
                    JsonData: JSON.stringify(layersService.getData()),
                    OsmUserId: this.osmUserService.isLoggedIn() ? this.osmUserService.userId : ""
                } as Common.SiteUrl;
                $http.post(Common.Urls.urls, siteUrl).success((siteUrlResponse: Common.SiteUrl) => {
                    $scope.siteUrlId = siteUrlResponse.Id;
                    $scope.shareAddress = osmUserService.getUrlFromSiteUrlId(siteUrlResponse);
                    $scope.imageUrl = osmUserService.getImageFromSiteUrlId(siteUrlResponse);
                    let escaped = ($window as any).encodeURIComponent($scope.shareAddress);
                    $scope.whatappShareAddress = `whatsapp://send?text=${escaped}`;
                    $scope.facebookShareAddress = `http://www.facebook.com/sharer/sharer.php?u=${escaped}`;
                    $scope.embedText = this.getEmbedText($scope);
                }).error(() => {
                    toastr.error($scope.resources.unableToGenerateUrl);
                }).finally(() => {
                    $scope.isLoading = false;
                });
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

            // currently can't be done from the UI until we decide how it should act.
            $scope.sendToOffroad = (userMail, title, description) => {
                if (layersService.getSelectedRoute() == null) {
                    toastr.warning($scope.resources.pleaseSelectARoute);
                    return;
                }
                let route = layersService.getSelectedRoute().getData();
                if (route.segments.length === 0) {
                    toastr.warning($scope.resources.pleaseAddPointsToRoute);
                    return;
                }
                let postData = {
                    userMail: userMail,
                    title: title,
                    activityType: "offRoading",
                    description: description,
                    sharingCode: 5, //fixed
                    path: []
                } as IOffroadPostRequest;
                for (let segment of route.segments) {
                    for (let latlngz of segment.latlngzs) {
                        postData.path.push({ altitude: latlngz.z, latitude: latlngz.lat, longitude: latlngz.lng });
                    }
                }
                let address = "https://brilliant-will-93906.appspot.com/_ah/api/myAdventureApi/v1/tracks/external";
                $http.post(address, postData).then(() => {
                    toastr.success("Route sent to off-road successfully");
                }, (err) => {
                    toastr.error(`Unable to sent route to off-road, ${JSON.stringify(err)}`);
                });
            }
        }

        private getEmbedText = ($scope: IShareScope) => {
            var shareAddress = `//${this.$window.location.host}${this.osmUserService.getSiteUrlPostfix($scope.siteUrlId)}`;
            return `<iframe src='${shareAddress}' width='${$scope.width}' height='${$scope.height}' frameborder='0' scrolling='no'></iframe>`;
        }
    }
}
