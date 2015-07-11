module IsraelHiking.Controllers {
    export interface IMarkerPopupScope extends angular.IScope {
        title: string;
        isInEditMode: boolean;
        toggleEditMode(): void;
        setTitle(title: string): void;
    }

    export class MarkerPopupController {
        constructor($scope: IMarkerPopupScope) {
            $scope.isInEditMode = false;
            $scope.toggleEditMode = () => {
                $scope.isInEditMode = !$scope.isInEditMode;
                if ($scope.isInEditMode == false) {
                    $scope.setTitle($scope.title)
                }
            }
        }
    }
} 