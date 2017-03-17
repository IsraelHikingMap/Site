namespace IsraelHiking.Directives {
    export interface ISyncFocusScope extends angular.IScope {
        syncFocusWith: boolean;
    }

    export class SyncFocusWithDirective {
        constructor($timeout: angular.ITimeoutService) {
            return {
                restrict: "A",
                scope: {
                    syncFocusWith: "="
                },
                link: ($scope: ISyncFocusScope, $element, attrs: any) => {
                    $scope.$watch(() => $scope.syncFocusWith, (currentValue: boolean) => {
                        if (currentValue) {
                            $timeout(() => $element[0].focus(), 100);
                        } else {
                            $timeout(() => $element[0].blur(), 100);
                        }
                    });
                }
            } as angular.IDirective;
        }
    }
}