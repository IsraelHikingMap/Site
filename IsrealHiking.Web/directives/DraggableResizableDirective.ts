namespace IsraelHiking.Directives {
    export interface IDraggableResizableScope extends angular.IScope {
        dragSelector: string;
        directions: string[];
    }

    export interface IInfoEventArgs {
        width: number | boolean;
        height: number | boolean;
        id: string;
    }

    type Axis = "x" | "y";
    type Direction = "left" | "right" | "top" | "bottom"

    export class DraggableResizableDirective implements angular.IDirective {
        constructor($document: angular.IDocumentService,
            $timeout: angular.ITimeoutService) {
            var toCall: Function;
            var throttle = (functionToThrottle: Function) => {
                if (toCall === undefined) {
                    toCall = functionToThrottle;
                    $timeout(() => {
                        toCall();
                        toCall = undefined;
                    },
                        100);
                } else {
                    toCall = functionToThrottle;
                }
            }

            return {
                scope: {
                    dragSelector: "=",
                    directions: "="
                },
                link: ($scope: IDraggableResizableScope, element: JQuery, attr) => {
                    let startX = 0, startY = 0, x = 0, y = 0;

                    let mouseDownEventString = "touchstart mousedown";
                    let mouseMoveEventString = "touchmove mousemove";
                    let mouseUpEventString = "touchend mouseup";

                    element.addClass("resizable");
                    var style = window.getComputedStyle(element[0], null),
                        width: number,
                        height: number,
                        start: number,
                        dragDirection: Direction,
                        axis: Axis,
                        info = {} as IInfoEventArgs;

                    let getBaseMouseMoveEvent = (event: JQueryEventObject): Touch | JQueryEventObject => {
                        return (event.type.toLowerCase() === "mousemove")
                            ? event
                            : (event.originalEvent as TouchEvent).touches[0];
                    }

                    let getBaseMouseDownEvent = (event: JQueryEventObject): Touch | JQueryEventObject => {
                        return (event.type.toLowerCase() === "mousedown")
                            ? event
                            : (event.originalEvent as TouchEvent).touches[0];
                    }

                    let updateInfo = () => {
                        info.width = false; info.height = false;
                        if (axis === "x")
                            info.width = parseInt(element[0].style.width);
                        else
                            info.height = parseInt(element[0].style.height);
                        info.id = element[0].id;
                    }

                    let resizeMouseMove = (event: JQueryEventObject) => {
                        let baseEvent = getBaseMouseMoveEvent(event);
                        let offset = axis === "x" ? start - baseEvent.clientX : start - baseEvent.clientY;
                        switch (dragDirection) {
                            case "top":
                                element[0].style.height = (height + offset) + "px";
                                break;
                            case "right":
                                element[0].style.width = (width - offset) + "px";
                                break;
                            case "bottom":
                                element[0].style.height = (height - offset) + "px";
                                break;
                            case "left":
                                element[0].style.width = (width + offset) + "px";
                                break;
                        }
                        updateInfo();
                        throttle(() => { $scope.$emit("angular-resizable.resizing", info); });
                    };

                    var resizeMouseUp = () => {
                        updateInfo();
                        $scope.$emit("angular-resizable.resizeEnd", info);
                        $scope.$apply();
                        $document.off(mouseUpEventString, resizeMouseUp);
                        $document.off(mouseMoveEventString, resizeMouseMove);
                        element.removeClass("no-transition");
                    };

                    var resizeMouseDown = (event, direction) => {
                        dragDirection = direction;
                        axis = dragDirection === "left" || dragDirection === "right" ? "x" : "y";
                        let baseEvent = getBaseMouseDownEvent(event);
                        start = axis === "x" ? baseEvent.clientX : baseEvent.clientY;
                        width = parseInt(style.getPropertyValue("width"));
                        height = parseInt(style.getPropertyValue("height"));

                        //prevent transition while dragging
                        element.addClass("no-transition");

                        $document.on(mouseUpEventString, resizeMouseUp);
                        $document.on(mouseMoveEventString, resizeMouseMove);

                        // Disable highlighting while dragging
                        if (event.stopPropagation) event.stopPropagation();
                        if (event.preventDefault) event.preventDefault();
                        event.cancelBubble = true;
                        event.returnValue = false;

                        updateInfo();
                        $scope.$emit("angular-resizable.resizeStart", info);
                        $scope.$apply();
                    };

                    for (let direction of $scope.directions) {
                        let grabber = angular.element("<div/>");
                        grabber.addClass(`rg-${direction}`);
                        grabber.append(angular.element("<span/>"));
                        element.append(grabber);
                        grabber.on("dragstart", () => false);
                        grabber.on(mouseDownEventString, e => { resizeMouseDown(e, direction); });
                    }

                    let moveMouseMove = (event: JQueryEventObject) => {

                        let pageX = getBaseMouseMoveEvent(event).pageX;
                        let pageY = getBaseMouseMoveEvent(event).pageY;
                        x = pageX - startX;
                        y = pageY - startY;
                        element.css({
                            top: y + "px",
                            left: x + "px"
                        });
                    }

                    let moveMouseUp = () => {
                        $document.off(mouseMoveEventString, moveMouseMove);
                        $document.off(mouseUpEventString, moveMouseUp);
                    }

                    element.on(mouseDownEventString, $scope.dragSelector, event => {
                        // HM TODO: fix touch screen exit and km markers
                        // Prevent default dragging of selected content
                        event.preventDefault();
                        let pageX = getBaseMouseDownEvent(event).pageX;
                        let pageY = getBaseMouseDownEvent(event).pageY;
                        startX = pageX - x;
                        startY = pageY - y;
                        $document.on(mouseMoveEventString, moveMouseMove);
                        $document.on(mouseUpEventString, moveMouseUp);
                    });
                }
            } as angular.IDirective;
        }
    }
}