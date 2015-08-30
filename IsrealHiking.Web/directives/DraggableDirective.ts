declare var interact;
module IsraelHiking.Directives {
    export class DraggableDirective {
        constructor() {
            return <angular.IDirective>{
                restrict: "A",
                scope: {
                    draggable: "=",
                },
                link: (scope, element: JQuery, attrs) => {
                    var handle = element[0];
                    if (!attrs.draggableHandle) {
                        handle = element.children(attrs.draggableHandle)[0];
                    }
                    var x = 0;
                    var y = 0;
                    interact(handle).draggable({
                        onmove: (event) => {
                            x += event.dx;
                            y += event.dy;
                            var transform = "translate(" + x + "px, " + y + "px)";
                            (<any>element[0].style).webkitTransform = transform;
                            element[0].style.transform = transform;
                        },
                        inertia: true,
                    });
                }
            }
        }
    }
}