module IsraelHiking.Directives {
    export class DisableMapMovementDirective {
        constructor(mapService: Services.MapService) {
            return <angular.IDirective>{
                restrict: 'A',
                link: function ($scope, $element, attrs) {
                    $element.on("mouseover", () => {
                        mapService.map.dragging.disable();
                        mapService.map.scrollWheelZoom.disable();
                    });
                    $element.on("mouseout", () => {
                        mapService.map.dragging.enable();
                        mapService.map.scrollWheelZoom.enable();
                    });
                }
            }
        }
    }
}