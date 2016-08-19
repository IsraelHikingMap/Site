declare class DocumentTouch {
};

namespace IsraelHiking.Directives {
    export interface IDraggableScope {
        selector: string;
    }

    export class DraggableDirective implements angular.IDirective {
        constructor($document: angular.IDocumentService) {
            return {
                link: ($scope: IDraggableScope, element: JQuery, attr) => {
                    var startX = 0, startY = 0, x = 0, y = 0;
                    element.on("touchstart mousedown", ".route-statistics-header", event => {
                        // HM TODO: fix touch screen exit and km markers
                        // Prevent default dragging of selected content
                        event.preventDefault();
                        let pageX = (event.type.toLowerCase() === "mousedown")
                            ? event.pageX
                            : (event.originalEvent as any).touches[0].pageX;
                        let pageY = (event.type.toLowerCase() === "mousedown")
                            ? event.pageY
                            : (event.originalEvent as any).touches[0].pageY;
                        startX = pageX - x;
                        startY = pageY - y;
                        $document.on("touchmove mousemove", mousemove);
                        $document.on("touchend mouseup", mouseup);
                    });

                    function mousemove(event) {
                        let pageX = (event.type.toLowerCase() === "mousemove")
                            ? event.pageX
                            : (event.originalEvent as any).touches[0].pageX;
                        let pageY = (event.type.toLowerCase() === "mousemove")
                            ? event.pageY
                            : (event.originalEvent as any).touches[0].pageY;
                        x = pageX - startX;
                        y = pageY - startY;
                        element.css({
                            top: y + "px",
                            left: x + "px"
                        });
                    }

                    function mouseup() {
                        $document.off("touchmove mousemove", mousemove);
                        $document.off("touchend mouseup", mouseup);
                    }
                }
            } as angular.IDirective;
        }
    }
}