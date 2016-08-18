namespace IsraelHiking.Directives {
    export class DraggableDirective implements angular.IDirective {
        constructor($document: angular.IDocumentService) {
            return {
                link: (scope, element, attr) => {
                    var startX = 0, startY = 0, x = 0, y = 0;

                    //element.css({
                    //    position: 'absolute',
                    //    cursor: 'pointer'
                    //});

                    element.on('mousedown', event => {
                        // Prevent default dragging of selected content
                        event.preventDefault();
                        startX = event.pageX - x;
                        startY = event.pageY - y;
                        $document.on('mousemove', mousemove);
                        $document.on('mouseup', mouseup);
                    });

                    function mousemove(event) {
                        y = event.pageY - startY;
                        x = event.pageX - startX;
                        element.css({
                            top: y + 'px',
                            left: x + 'px'
                        });
                    }

                    function mouseup() {
                        $document.off('mousemove', mousemove);
                        $document.off('mouseup', mouseup);
                    }
                }
            } as angular.IDirective;
        }
    }
}