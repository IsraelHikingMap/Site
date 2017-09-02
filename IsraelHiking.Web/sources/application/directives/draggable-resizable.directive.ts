import { Directive, ElementRef, Input, Output, OnInit, EventEmitter, Renderer2 } from "@angular/core";
import * as L from "leaflet";

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

    private toCall: Function;

    private unlistenFunctionArray: Function[];
    
    constructor(private element: ElementRef,
        private renderer: Renderer2) {
        this.renderer.addClass(element.nativeElement, "resizable");
        this.style = window.getComputedStyle(this.element.nativeElement);
        this.unlistenFunctionArray = [];
    }

    public ngOnInit() {
        if (this.dragSelector) {
            var moveSlector = this.element.nativeElement.querySelector(this.dragSelector);
            mouseDownEventString.split(" ").forEach(eventString => moveSlector.addEventListener(eventString, this.moveMouseDown));
        }
        for (let direction of this.directions) {
            let grabber = L.DomUtil.create("div", `drag-handle-${direction}`, this.element.nativeElement);
            L.DomUtil.create("span", "", grabber);
            grabber.addEventListener("dragstart", () => false);
            mouseDownEventString.split(" ").forEach((eventString) => grabber.addEventListener(eventString, (e) => { this.resizeMouseDown(e, direction); }));
        }
    }

    private initialize = (event: Event) => {
        this.initialClientX = this.getClientX(event);
        this.initialClientY = this.getClientY(event);
        this.initialTop = parseInt(this.style.getPropertyValue("top"));
        this.initialBottom = parseInt(this.style.getPropertyValue("bottom"));
        this.initialLeft = parseInt(this.style.getPropertyValue("left"));
        this.initialRight = parseInt(this.style.getPropertyValue("right"));
    }

    private getClientX(event: Event): number {
        return (event instanceof MouseEvent)
            ? event.clientX
            : (event as TouchEvent).touches[0].clientX;
    }

    private getClientY(event: Event): number {
        return (event instanceof MouseEvent)
            ? event.clientY
            : (event as TouchEvent).touches[0].clientY;
    }

    private isHorizontal(dragDirection: Direction) {
        return dragDirection === "left" || dragDirection === "right";
    }

    private moveMouseMove = (event: Event) => {
        let clientX = this.getClientX(event);
        let clientY = this.getClientY(event);
        let offsetX = clientX - this.initialClientX;
        let offsetY = clientY - this.initialClientY;

        let style = this.element.nativeElement.style;
        style.top = this.getTop(this.initialTop + offsetY) + "px";
        style.left = (this.initialLeft + offsetX) + "px";
        style.right = (this.initialRight - offsetX) + "px";
        style.bottom = (this.initialBottom - offsetY) + "px";
    }

    private getTop(newTop: number): number {
        return (newTop < 0 ? 0 : newTop);
    }

    private moveMouseUp = () => {
        this.unlistenFunctionArray.forEach(unlistenFunction => unlistenFunction());
        this.unlistenFunctionArray.splice(0);
    }

    private moveMouseDown = (event: MouseEvent) => {
        // Prevent default dragging of selected content
        event.preventDefault();
        this.initialize(event);
        mouseMoveEventString.split(" ").forEach(eventString => {
            let unlistenFunction = this.renderer.listen("document", eventString, this.moveMouseMove);
            this.unlistenFunctionArray.push(unlistenFunction);
        });
        mouseUpEventString.split(" ").forEach(eventString => {
            let unlistenFunction = this.renderer.listen("document", eventString, this.moveMouseUp);
            this.unlistenFunctionArray.push(unlistenFunction);
        });
    }

    // resizable events
    private createResizeEventArgs = (): IResizeEventArgs => {
        let eventArgs = {} as IResizeEventArgs;
        eventArgs.width = false;
        eventArgs.height = false;
        if (this.isHorizontal(this.dragDirection)) {
            eventArgs.width = parseInt(this.element.nativeElement.style.width);
        } else {
            eventArgs.height = parseInt(this.element.nativeElement.style.height);
        }
        eventArgs.id = this.element.nativeElement.id;
        return eventArgs;
    }

    private resizeMouseDown = (event: Event, direction: Direction) => {
        this.dragDirection = direction;
        this.initialize(event);
        //prevent transition while dragging
        this.renderer.addClass(this.element.nativeElement, "no-transition");
        
        mouseMoveEventString.split(" ").forEach(eventString => {
            let unlistenFunction = this.renderer.listen("document", eventString, this.resizeMouseMove);
            this.unlistenFunctionArray.push(unlistenFunction);
        });
        mouseUpEventString.split(" ").forEach(eventString => {
            let unlistenFunction = this.renderer.listen("document", eventString, this.resizeMouseUp);
            this.unlistenFunctionArray.push(unlistenFunction);
        });

        // Disable highlighting while dragging
        if (event.stopPropagation) event.stopPropagation();
        if (event.preventDefault) event.preventDefault();
    };

    private resizeMouseMove = (event: Event) => {
        let offset = this.isHorizontal(this.dragDirection)
            ? this.getClientX(event) - this.initialClientX
            : this.getClientY(event) - this.initialClientY;
        let style = this.element.nativeElement.style;
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
        this.unlistenFunctionArray.forEach(unlistenFunction => unlistenFunction());
        this.unlistenFunctionArray.splice(0);
        this.renderer.removeClass(this.element.nativeElement, "no-transition");
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