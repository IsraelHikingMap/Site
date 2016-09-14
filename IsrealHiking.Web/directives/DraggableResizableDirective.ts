namespace IsraelHiking.Directives {
    export interface IDraggableResizableScope extends angular.IScope {
        dragSelector: string;
        directions: Direction[];
    }

    export interface IResizeEventArgs {
        width: number | boolean;
        height: number | boolean;
        id: string;
    }

    type Direction = "left" | "right" | "top" | "bottom"

    export class DraggableResizableDirective implements angular.IDirective {
        constructor($document: angular.IDocumentService,
            $timeout: angular.ITimeoutService,
            $window: angular.IWindowService) {
            var toCall: Function;

            function throttle(functionToThrottle: Function) {
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

            function getBaseMouseMoveEvent(event: JQueryEventObject): Touch | JQueryEventObject {
                return (event.type.toLowerCase() === "mousemove")
                    ? event
                    : (event.originalEvent as TouchEvent).touches[0];
            }

            function getBaseMouseDownEvent(event: JQueryEventObject): Touch | JQueryEventObject {
                return (event.type.toLowerCase() === "mousedown")
                    ? event
                    : (event.originalEvent as TouchEvent).touches[0];
            }

            function isHorizontal(dragDirection: Direction) {
                return dragDirection === "left" || dragDirection === "right";
            }

            return {
                scope: {
                    dragSelector: "=",
                    directions: "="
                },
                link: ($scope: IDraggableResizableScope, element: JQuery) => {

                    let mouseDownEventString = "touchstart mousedown";
                    let mouseMoveEventString = "touchmove mousemove";
                    let mouseUpEventString = "touchend mouseup";

                    element.addClass("resizable");
                    var style = $window.getComputedStyle(element[0]);
                    var dragDirection: Direction;
                    var initialClientX: number;
                    var initialClientY: number;
                    var initialTop: number;
                    var initialLeft: number;
                    var initialRight: number;
                    var initialHeight: number;

                    function initialize(event: JQueryEventObject) {
                        initialClientX = getBaseMouseDownEvent(event).clientX;
                        initialClientY = getBaseMouseDownEvent(event).clientY;
                        initialTop = parseInt(style.getPropertyValue("top"));
                        initialLeft = parseInt(style.getPropertyValue("left"));
                        initialRight = parseInt(style.getPropertyValue("right"));
                        initialHeight = parseInt(style.getPropertyValue("height"));
                    }

                    element.on(mouseDownEventString, $scope.dragSelector, moveMouseDown);

                    for (let direction of $scope.directions) {
                        let grabber = angular.element("<div/>");
                        grabber.addClass(`drag-handle-${direction}`);
                        grabber.append(angular.element("<span/>"));
                        element.append(grabber);
                        grabber.on("dragstart", () => false);
                        grabber.on(mouseDownEventString, e => { resizeMouseDown(e, direction); });
                    }

                    // resizable events
                    function createResizeEventArgs(): IResizeEventArgs {
                        let eventArgs = {} as IResizeEventArgs;
                        eventArgs.width = false;
                        eventArgs.height = false;
                        if (isHorizontal(dragDirection)) {
                            eventArgs.width = parseInt(element[0].style.width);
                        } else {
                            eventArgs.height = parseInt(element[0].style.height);
                        }
                        eventArgs.id = element[0].id;
                        return eventArgs;
                    }

                    function resizeMouseMove(event: JQueryEventObject) {
                        let offset = isHorizontal(dragDirection) ? getBaseMouseMoveEvent(event).clientX - initialClientX : getBaseMouseMoveEvent(event).clientY - initialClientY;
                        switch (dragDirection) {
                            case "top":
                                element[0].style.height = (initialHeight - offset) + "px";
                                element[0].style.top = getTop(initialTop + offset) + "px";
                                break;
                            case "left":
                                element[0].style.left = (initialLeft + offset) + "px";
                                break;
                            case "bottom":
                                element[0].style.height = (initialHeight + offset) + "px";
                                break;
                            case "right":
                                element[0].style.right = (initialRight - offset) + "px";
                                break;

                        }
                        throttle(() => { $scope.$emit("angular-resizable.resizing", createResizeEventArgs()); });
                    };

                    function resizeMouseUp() {
                        $scope.$emit("angular-resizable.resizeEnd", createResizeEventArgs());
                        $scope.$apply();
                        $document.off(mouseUpEventString, resizeMouseUp);
                        $document.off(mouseMoveEventString, resizeMouseMove);
                        element.removeClass("no-transition");
                    };

                    function resizeMouseDown(event: JQueryEventObject, direction: Direction) {
                        dragDirection = direction;
                        initialize(event);
                        //prevent transition while dragging
                        element.addClass("no-transition");

                        $document.on(mouseUpEventString, resizeMouseUp);
                        $document.on(mouseMoveEventString, resizeMouseMove);

                        // Disable highlighting while dragging
                        if (event.stopPropagation) event.stopPropagation();
                        if (event.preventDefault) event.preventDefault();
                        event.cancelBubble = true;
                        event.returnValue = false;

                        $scope.$emit("angular-resizable.resizeStart", createResizeEventArgs());
                        $scope.$apply();
                    };

                    // draggable events
                    function moveMouseMove(event: JQueryEventObject) {

                        let clientX = getBaseMouseMoveEvent(event).clientX;
                        let clientY = getBaseMouseMoveEvent(event).clientY;
                        let offsetX = clientX - initialClientX;
                        let offsetY = clientY - initialClientY;

                        element[0].style.top = getTop(initialTop + offsetY) + "px";
                        element[0].style.left = (initialLeft + offsetX) + "px";
                        element[0].style.right = (initialRight - offsetX) + "px";
                    }

                    function getTop(newTop :number): number {
                        return (newTop < 0 ? 0 : newTop);
                    }

                    function moveMouseUp() {
                        $document.off(mouseMoveEventString, moveMouseMove);
                        $document.off(mouseUpEventString, moveMouseUp);
                    }

                    function moveMouseDown(event: JQueryEventObject) {
                        // Prevent default dragging of selected content
                        event.preventDefault();
                        initialize(event);
                        $document.on(mouseMoveEventString, moveMouseMove);
                        $document.on(mouseUpEventString, moveMouseUp);
                    }
                }
            } as angular.IDirective;
        }
    }
}