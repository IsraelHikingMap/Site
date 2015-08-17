module IsraelHiking.Directives {
    export class SyncFocusWithDirective {
        constructor() {
            return <angular.IDirective>{
                restrict: 'A',
                scope: {
                    focusValue: "=syncFocusWith"
                },
                link: function ($scope, $element, attrs) {
                    $scope.$watch("focusValue", function (currentValue, previousValue) {
                        if (currentValue === true && !previousValue) {
                            setTimeout(() => $element[0].focus(), 0);
                        } else if (currentValue === false && previousValue) {
                            setTimeout(() => $element[0].blur(), 0);
                        }
                    })
                }
            }
        }
    }
}