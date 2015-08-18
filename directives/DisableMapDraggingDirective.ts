module IsraelHiking.Directives {
    export class DisableMapDraggingDirective {
        constructor(mapService: Services.MapService) {
            return <angular.IDirective>{
                restrict: 'A',
                link: function ($scope, $element, attrs) {
                    $element.on("mouseover", () => {
                        mapService.map.dragging.disable();
                    });
                    $element.on("mouseout", () => {
                        mapService.map.dragging.enable();
                    });
                }
            }
        }
    }
}