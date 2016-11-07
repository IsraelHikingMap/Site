namespace IsraelHiking.Controllers {

    export interface IOsmUserScope extends IRootScope {
        userService: Services.OsmUserService;
        login(e: Event);
        openUserDetails(e: Event);
    }

    export class OsmUserController extends BaseMapController {
        constructor($scope: IOsmUserScope,
            $uibModal: angular.ui.bootstrap.IModalService,
            mapService: Services.MapService,
            osmUserService: Services.OsmUserService) {
            super(mapService);
            $scope.userService = osmUserService;

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
                $uibModal.open({
                    scope: $scope,
                    templateUrl: "controllers/osmUserDetailsModal.html"
                });
            }
        }
    }

}