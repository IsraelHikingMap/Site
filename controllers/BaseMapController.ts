module IsraelHiking.Controllers {

    export class BaseMapController extends Services.ObjectWithMap {
       
        suppressEvents(e: Event) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
        }
    }

    export class BaseMapControllerWithToolTip extends BaseMapController {
        $tooltip;

        constructor(mapService: Services.MapService, $tooltip) {
            super(mapService);
            this.$tooltip = $tooltip;
        }

        protected createToolTip(target: any, template: string, title: string, $scope: angular.IScope) {
            var element = angular.element(target);
            if (element.is("i")) {
                // user clicked on the icon, we want to open the tooltip from the button.
                element = <any>element.parent();
            }
            return this.$tooltip(element, {
                templateUrl: template,
                trigger: "click",
                placement: "right",
                title: title,
                container: "body",
                scope: $scope,
            });
        }
    }

} 