namespace IsraelHiking.Controllers.MarkerPopup {

    export interface IMissingPartMarkerPopupScope extends MarkerPopup.IRemovableMarkerScope {
        feature: GeoJSON.Feature<GeoJSON.LineString>;
        getHighwayType(): string;
        setHighwayType(highwayType: string): void;
        getColor(): string;
        setColor(color: string): void;
        addMissingPartToOsm();
    }

    export class MissingPartMarkerPopupController extends MarkerPopupController {
        constructor($scope: IMissingPartMarkerPopupScope,
            $http: angular.IHttpService,
            elevationProvider: Services.Elevation.ElevationProvider,
            osmUserService: Services.OsmUserService,
            toastr: Toastr) {
            super($scope, $http, elevationProvider);

            $scope.getHighwayType = (): string => {
                return $scope.feature.properties["highway"] || "track";
            }

            $scope.setHighwayType = (highwayType: string) => {
                $scope.feature.properties["highway"] = highwayType;
            }

            $scope.getColor = (): string => {
                return $scope.feature.properties["colour"] || "none";
            }

            $scope.setColor = (color: string) => {
                $scope.feature.properties["colour"] = color;
                if (color === "none") {
                    delete $scope.feature.properties["colour"];
                }
            }

            $scope.addMissingPartToOsm = () => {
                osmUserService.addAMissingPart($scope.feature).then(() => {
                    toastr.success($scope.resources.routeAddedSuccessfullyItWillTakeTime);
                    $scope.remove();
                }, () => {
                    toastr.error($scope.resources.unableToSendRoute);
                });
            }
        }
    }
}