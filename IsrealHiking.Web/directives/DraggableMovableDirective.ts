declare var interact;
namespace IsraelHiking.Directives {

    export class DraggableMovableDirective {
        constructor($window: angular.IWindowService) {
            return {
                restrict: "A",
                link: ($scope: angular.IScope, element: JQuery, attrs) => {
                    var handle = element[0];
                    if (attrs.handle) {
                        handle = element.find(attrs.handle)[0];
                    }
                    //var x = 0;
                    //var y = 0;
                    var inertia = interact(handle).draggable({
                        onmove: (event) => {
                            var target = event.target;
                            // keep the dragged position in the data-x/data-y attributes
                            let x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx;
                            let y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;

                            // translate the element
                            target.style.webkitTransform = target.style.transform = `translate(${x}px, ${y}px)`;

                            // update the position attributes
                            target.setAttribute("data-x", x);
                            target.setAttribute("data-y", y);
                        },
                        inertia: true
                    }).resizable({
                        edges: { left: true, right: true },
                        onmove: (event) => {
                            var target = event.target;
                            let x = (parseFloat(target.getAttribute("data-x")) || 0);
                            let y = (parseFloat(target.getAttribute("data-y")) || 0);

                            // update the element"s style
                            target.style.width = event.rect.width + "px";
                            target.style.height = event.rect.height + "px";

                            // translate when resizing from top or left edges
                            x += event.deltaRect.left;
                            y += event.deltaRect.top;

                            target.style.webkitTransform = target.style.transform = `translate(${x}px,${y}px)`;

                            target.setAttribute("data-x", x);
                            target.setAttribute("data-y", y);
                        },
                        onend: (event) => {
                            //var Evt: any = Event; // typescipt compilation issue...
                            $window.dispatchEvent(new Event("resize"));
                        }
                    });

                    $scope.$on("$destroy", () => {
                        inertia.unset();
                    });
                }
            } as angular.IDirective;
        }
    }
}