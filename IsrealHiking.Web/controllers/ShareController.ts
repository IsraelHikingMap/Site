namespace IsraelHiking.Controllers {

    export interface IIOffroadCoordinates {
        latitude: number;
        longitude: number;
        altitude: number;
    }

    export interface IOffroadPostRequest {
        userMail: string;
        title: string;
        description: string;
        activityType: string;
        difficultyLevel: string;
        sharingCode: number; //should be 5 fixed
        path: IIOffroadCoordinates[];
        mapItems: IIOffroadMarker[];
        external_url: string;
    }

    export interface IIOffroadMarker {
        title: string;
        description: string;
        visibilityLevel: string;
        mapItemType: string;
        point: IIOffroadCoordinates;
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
        offroadRequest: IOffroadPostRequest;
        openShare(e: Event);
        updateEmbedText(width: number, height: number): void;
        generateUrl(title: string, description: string): void;
        clearShareAddress(): void;
        setSize(size: string): void;
        sendToOffroad(): void;
    }

    export class ShareController extends BaseMapController {
        private $window: angular.IWindowService;
        private osmUserService: Services.OsmUserService;

        private static USER_EMAIL_KEY = "offroadUserEmail";

        constructor($scope: IShareScope,
            $uibModal: angular.ui.bootstrap.IModalService,
            $http: angular.IHttpService,
            $window: angular.IWindowService,
            localStorageService: angular.local.storage.ILocalStorageService,
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
                if (layersService.getSelectedRoute() != null) {
                    let route = layersService.getSelectedRoute().getData();
                    $scope.title = route.name;
                    $scope.offroadRequest = {} as IOffroadPostRequest;
                    $scope.offroadRequest.userMail = localStorageService.get(ShareController.USER_EMAIL_KEY) as string || "";
                    $scope.offroadRequest.activityType = "OffRoading";
                    $scope.offroadRequest.difficultyLevel = "3";
                    if (route.segments.length > 0) {
                        switch (route.segments[route.segments.length - 1].routingType) {
                            case "Hike":
                                $scope.offroadRequest.activityType = "Walking";
                                break;
                            case "Bike":
                                $scope.offroadRequest.activityType = "Cycling";
                                break;
                        }    
                    }
                }
                
                $uibModal.open({
                    templateUrl: "controllers/shareModal.html",
                    scope: $scope
                });
                this.suppressEvents(e);
            }

            $scope.generateUrl = (title: string, description: string) => {
                $scope.isLoading = true;
                $scope.offroadRequest.title = title;
                $scope.offroadRequest.description = description;
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
            $scope.sendToOffroad = () => {
                localStorageService.set(ShareController.USER_EMAIL_KEY, $scope.offroadRequest.userMail);
                if (layersService.getSelectedRoute() == null) {
                    toastr.warning($scope.resources.pleaseSelectARoute);
                    return;
                }
                let route = layersService.getSelectedRoute().getData();
                if (route.segments.length === 0) {
                    toastr.warning($scope.resources.pleaseAddPointsToRoute);
                    return;
                }
                $scope.offroadRequest.sharingCode = 5; //fixed
                $scope.offroadRequest.path = [];
                $scope.offroadRequest.mapItems = [];
                $scope.offroadRequest.external_url = $scope.shareAddress;

                for (let segment of route.segments) {
                    for (let latlngz of segment.latlngzs) {
                        $scope.offroadRequest.path.push({ altitude: latlngz.z, latitude: latlngz.lat, longitude: latlngz.lng });
                    }
                }
                let index = 0;
                for (let marker of layersService.getMarkers().markers) {
                    $scope.offroadRequest.mapItems.push({
                        title: `Point ${index++}`,
                        mapItemType: "POI",
                        visibilityLevel: "Track",
                        description: marker.title,
                        point: { latitude: marker.latlng.lat, longitude: marker.latlng.lng, altitude: 0 }
                    });
                }
                let address = "https://brilliant-will-93906.appspot.com/_ah/api/myAdventureApi/v1/tracks/external";
                $http.post(address, $scope.offroadRequest).then(() => {
                    toastr.success($scope.resources.routeSentSuccessfully);
                }, (err) => {
                    toastr.error($scope.resources.unableToSendRoute);
                    console.error(err);
                });
            }
        }

        private getEmbedText = ($scope: IShareScope) => {
            var shareAddress = `//${this.$window.location.host}${this.osmUserService.getSiteUrlPostfix($scope.siteUrlId)}`;
            return `<iframe src='${shareAddress}' width='${$scope.width}' height='${$scope.height}' frameborder='0' scrolling='no'></iframe>`;
        }
    }
}
