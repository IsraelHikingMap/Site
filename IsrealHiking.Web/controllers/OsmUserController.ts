namespace IsraelHiking.Controllers {

    interface IRank {
        name: string;
        points: number;
    }

    export interface IOsmUserScope extends IRootScope {
        ranks: IRank[];
        userService: Services.OsmUserService;
        login(e: Event);
        openUserDetails(e: Event);
        getImageFromSiteUrlId(siteUrl: Common.SiteUrl);
        getUrlFromSiteUrlId(siteUrl: Common.SiteUrl);
        getRank(): IRank;
        getRankPercentage(): number;
        getPorgessbarType(): string;
    }

    export class OsmUserController extends BaseMapController {
        constructor($scope: IOsmUserScope,
            $uibModal: angular.ui.bootstrap.IModalService,
            mapService: Services.MapService,
            osmUserService: Services.OsmUserService) {
            super(mapService);
            $scope.userService = osmUserService;
            $scope.ranks = [
                {
                    name: $scope.resources.junior,
                    points: 10
                },
                {
                    name: $scope.resources.partner,
                    points: 100
                },
                {
                    name: $scope.resources.master,
                    points: 1000
                },
                {
                    name: $scope.resources.guru,
                    points: Infinity
                },
            ];


            $scope.login = (e: Event) => {
                this.suppressEvents(e);
                osmUserService.login().then(() => {
                    // osm login creates a new page and therefore the scope get out of sync.
                    if (!$scope.$$phase) {
                        $scope.$apply();
                    }
                }, () => {
                    toastr.warning($scope.resources.unableToLogin);
                });
            }

            $scope.openUserDetails = (e: Event) => {
                this.suppressEvents(e);
                osmUserService.refreshDetails();
                $uibModal.open({
                    scope: $scope,
                    templateUrl: "controllers/osmUserDetailsModal.html"
                });
            }

            $scope.getImageFromSiteUrlId = (siteUrl: Common.SiteUrl) => {
                return Common.Urls.images + siteUrl.Id;
            }

            $scope.getUrlFromSiteUrlId = (siteUrl: Common.SiteUrl) => {
                return Common.Urls.baseAddress + osmUserService.getSiteUrlPostfix(siteUrl.Id);
            }

            $scope.getRank = () => {
                let rankIndex = 0;
                while (osmUserService.changeSets > $scope.ranks[rankIndex].points) {
                    rankIndex ++;
                }
                return $scope.ranks[rankIndex];
            }

            $scope.getRankPercentage = () => {
                let rank = $scope.getRank();
                if (rank === $scope.ranks[$scope.ranks.length - 1]) {
                    return 100;
                }
                return ((osmUserService.changeSets / rank.points) * 100);
            }

            $scope.getPorgessbarType = () => {
                if ($scope.getRankPercentage() < 5) {
                    return "danger";
                }
                if ($scope.getRankPercentage() < 30) {
                    return "warning";
                }
                return "success";
            }
        }
    }

}