import { Directive, ElementRef, Input, Output, OnInit, EventEmitter } from "@angular/core";
import * as $ from "jquery";

export interface IResizeEventArgs {
    width: number | boolean;
    height: number | boolean;
    id: string;
}

type Direction = "left" | "right" | "top" | "bottom"

const mouseDownEventString = "touchstart mousedown";
const mouseMoveEventString = "touchmove mousemove";
const mouseUpEventString = "touchend mouseup";


@Directive({
    selector: "[draggable-resizable]"
})
export class DraggableResizableDirective implements OnInit {
    private style: CSSStyleDeclaration;
    private dragDirection: Direction;
    private initialClientX: number;
    private initialClientY: number;
    private initialTop: number;
    private initialBottom: number;
    private initialLeft: number;
    private initialRight: number;

    @Input()
    public dragSelector: string;
    @Input()
    public directions: Direction[];
    @Output()
    public onResize = new EventEmitter<IResizeEventArgs>();

    private jqueryElement: JQuery;
    private toCall: Function;
    constructor(element: ElementRef) {
        this.jqueryElement = $(element.nativeElement);

        this.jqueryElement.addClass("resizable");
        this.style = window.getComputedStyle(this.jqueryElement[0]);
    }

    public ngOnInit() {
        if (this.dragSelector) {
            this.jqueryElement.on(mouseDownEventString, this.dragSelector, this.moveMouseDown);
        }
        for (let direction of this.directions) {
            let grabber = $("<div/>");
            grabber.addClass(`drag-handle-${direction}`);
            grabber.append($("<span/>"));
            this.jqueryElement.append(grabber);
            grabber.on("dragstart", () => false);
            grabber.on(mouseDownEventString, e => { this.resizeMouseDown(e, direction); });
        }
    }

    private initialize = (event: JQueryEventObject) => {
        this.initialClientX = this.getBaseMouseDownEvent(event).clientX;
        this.initialClientY = this.getBaseMouseDownEvent(event).clientY;
        this.initialTop = parseInt(this.style.getPropertyValue("top"));
        this.initialBottom = parseInt(this.style.getPropertyValue("bottom"));
        this.initialLeft = parseInt(this.style.getPropertyValue("left"));
        this.initialRight = parseInt(this.style.getPropertyValue("right"));
    }

    private getBaseMouseMoveEvent(event: JQueryEventObject): Touch | JQueryEventObject {
        return (event.type.toLowerCase() === "mousemove")
            ? event
            : (event.originalEvent as TouchEvent).touches[0];
    }

    private getBaseMouseDownEvent(event: JQueryEventObject): Touch | JQueryEventObject {
        return (event.type.toLowerCase() === "mousedown")
            ? event
            : (event.originalEvent as TouchEvent).touches[0];
    }

    private isHorizontal(dragDirection: Direction) {
        return dragDirection === "left" || dragDirection === "right";
    }

    private moveMouseMove = (event: JQueryEventObject) => {

        let clientX = this.getBaseMouseMoveEvent(event).clientX;
        let clientY = this.getBaseMouseMoveEvent(event).clientY;
        let offsetX = clientX - this.initialClientX;
        let offsetY = clientY - this.initialClientY;

        let style = this.jqueryElement[0].style;
        style.top = this.getTop(this.initialTop + offsetY) + "px";
        style.left = (this.initialLeft + offsetX) + "px";
        style.right = (this.initialRight - offsetX) + "px";
        style.bottom = (this.initialBottom - offsetY) + "px";
    }

    private getTop(newTop: number): number {
        return (newTop < 0 ? 0 : newTop);
    }

    private moveMouseUp = () => {
        $(document).off(mouseMoveEventString, this.moveMouseMove);
        $(document).off(mouseUpEventString, this.moveMouseUp);
    }

    private moveMouseDown = (event: JQueryEventObject) => {
        // Prevent default dragging of selected content
        event.preventDefault();
        this.initialize(event);
        $(document).on(mouseMoveEventString, this.moveMouseMove);
        $(document).on(mouseUpEventString, this.moveMouseUp);
    }

    // resizable events
    private createResizeEventArgs = (): IResizeEventArgs => {
        let eventArgs = {} as IResizeEventArgs;
        eventArgs.width = false;
        eventArgs.height = false;
        if (this.isHorizontal(this.dragDirection)) {
            eventArgs.width = parseInt(this.jqueryElement[0].style.width);
        } else {
            eventArgs.height = parseInt(this.jqueryElement[0].style.height);
        }
        eventArgs.id = this.jqueryElement[0].id;
        return eventArgs;
    }

    private resizeMouseDown = (event: JQueryEventObject, direction: Direction) => {
        this.dragDirection = direction;
        this.initialize(event);
        //prevent transition while dragging
        this.jqueryElement.addClass("no-transition");

        $(document).on(mouseUpEventString, this.resizeMouseUp);
        $(document).on(mouseMoveEventString, this.resizeMouseMove);

        // Disable highlighting while dragging
        if (event.stopPropagation) event.stopPropagation();
        if (event.preventDefault) event.preventDefault();
    };

    private resizeMouseMove = (event: JQueryEventObject) => {
        let offset = this.isHorizontal(this.dragDirection)
            ? this.getBaseMouseMoveEvent(event).clientX - this.initialClientX
            : this.getBaseMouseMoveEvent(event).clientY - this.initialClientY;
        let style = this.jqueryElement[0].style;
        switch (this.dragDirection) {
            case "top":
                style.top = this.getTop(this.initialTop + offset) + "px";
                break;
            case "left":
                style.left = (this.initialLeft + offset) + "px";
                break;
            case "bottom":
                style.bottom = (this.initialBottom - offset) + "px";
                break;
            case "right":
                style.right = (this.initialRight - offset) + "px";
                break;

        }
        this.throttle(() => { this.onResize.emit(this.createResizeEventArgs()); });
    };

    private resizeMouseUp = () => {
        $(document).off(mouseUpEventString, this.resizeMouseUp);
        $(document).off(mouseMoveEventString, this.resizeMouseMove);
        this.jqueryElement.removeClass("no-transition");
    };

    private throttle = (functionToThrottle: Function) => {
        if (this.toCall === undefined) {
            this.toCall = functionToThrottle;
            setTimeout(() => {
                this.toCall();
                this.toCall = undefined;
            }, 100);
        } else {
            this.toCall = functionToThrottle;
        }
    }
}