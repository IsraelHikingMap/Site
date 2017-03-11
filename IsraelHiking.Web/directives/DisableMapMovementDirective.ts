namespace IsraelHiking.Directives {
    export class DisableMapMovementDirective {
        constructor() {
            return {
                restrict: "A",
                link: ($scope, element, attrs) => {
                    element.on("touchmove mousemove scroll",
                        (e) => {
                            e.stopPropagation();
                        });
                }
            } as angular.IDirective;
        }
    }
}