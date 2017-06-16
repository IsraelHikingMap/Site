// downloaded from: https://github.com/drusso85/ng2-scroll-to
import { Directive, ElementRef, Input, HostListener, Injector } from "@angular/core";
import { DOCUMENT } from "@angular/platform-browser";

@Directive({
    selector: "[scrollTo]"
})
export class ScrollToDirective {
    @Input() scrollableElementSelector: string;
    @Input() scrollTargetSelector: string;
    @Input() scrollYTarget: number;

    private doc: Document;

    constructor(private el: ElementRef, private injector: Injector) {
        this.doc = this.injector.get(DOCUMENT);
    }

    @HostListener("click", ["$event"]) onClick(event: MouseEvent) {
        event.preventDefault();
        let scrollEnd: number;
        if (this.scrollYTarget) {
            if (isNaN(Number(this.scrollYTarget))) {
                throw "scrollYTarget must have numerical values";
            }
            scrollEnd = this.scrollYTarget;
        }
        let target: HTMLElement;
        if (scrollEnd == null) {
            target = this.getTarget();
            if (!target) {
                console.warn("target element do not exist");
                return;
            }
            scrollEnd = target.offsetTop;
        }
        let scrollingElement: HTMLElement = this.getScrollableElement(target);
        try {
            if (scrollingElement === this.doc.body) {
                this.smoothScroll(this.doc.documentElement, scrollEnd);
            }
        } catch (e) { console.warn(e) }

        this.smoothScroll(scrollingElement, scrollEnd);
    }

    private getScrollableElement(target: HTMLElement): HTMLElement {
        let scrollableElement: HTMLElement;
        if (this.scrollableElementSelector) {
            scrollableElement = <HTMLElement>this.doc.querySelector(this.scrollableElementSelector);
        } else if (target != null) {
            scrollableElement = this.findScrollableParent(target);
        } else {
            scrollableElement = this.findMainScrollableElement();
        }
        return scrollableElement;
    }

    private getTarget(): HTMLElement {
        let target: HTMLElement;
        if (this.scrollTargetSelector) {
            target = <HTMLElement>this.doc.querySelector(this.scrollTargetSelector);
        } else if (this.el.nativeElement.href) {
            let href: string = "#" + this.el.nativeElement.href.split("#")[1];
            target = <HTMLElement>this.doc.querySelector(href);
        }
        return target;
    }

    private smoothScroll(element: HTMLElement, end: number): void {
        const duration = 500;
        const clock: number = Date.now();
        const requestAnimationFrame = window.requestAnimationFrame || function (fn) {
            window.setTimeout(fn, 15);
        };
        const start: number = element.scrollTop;
        let step = () => {
            let elapsed = Date.now() - clock;
            let position = this.position(start, end, elapsed, duration);
            element.scrollTop = position;
            if (elapsed > duration) {
            } else {
                requestAnimationFrame(step);
            }
        };
        step();
    }

    // ease in out function thanks to:
    // http://blog.greweb.fr/2012/02/bezier-curve-based-easing-functions-from-concept-to-implementation/
    easeInOutCubic(t: number): number {
        return t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }
    /**
      * calculate the scroll position we should be in
      * given the start and end point of the scroll
      * the time elapsed from the beginning of the scroll
      * and the total duration of the scroll (default 500ms)
      */
    private position(start: number, end: number, elapsed: number, duration: number): number {
        if (elapsed > duration) {
            return end;
        };
        return start + (end - start) * this.easeInOutCubic(elapsed / duration); // <-- you can change the easing funtion there
        // return start + (end - start) * (elapsed / duration); // <-- this would give a linear scroll
    }


    /**
      * finds scrollable parent of an element
      * @method findScrollableParent
      * @param {HTMLElement} element
      * @returns {HTMLElement} element
      */
    private findScrollableParent(element: HTMLElement): HTMLElement {
        let isBody: boolean,
            hasScrollableSpace: boolean,
            hasVisibleOverflow: boolean;
        do {
            element = element.parentElement;
            // set condition variables
            isBody = element === this.doc.body;
            hasScrollableSpace = element.clientHeight < element.scrollHeight;
            hasVisibleOverflow = getComputedStyle(element, null).overflow === "visible";
        } while (!isBody && !(hasScrollableSpace && !hasVisibleOverflow));
        return element;
    }


    /**
      * finds scrollable parent of an element
      * @method findMainScrollableElement
      * @returns {HTMLElement} element
      */
    private findMainScrollableElement(): HTMLElement {
        let element: HTMLElement = this.findScrollableChild(this.doc.body);
        if (element != null) {
            return element;
        }
        return this.doc.body;
    }

    private isScrollable(element: HTMLElement): boolean {
        let hasScrollableSpace = element.clientHeight < element.scrollHeight;
        let hasVisibleOverflow = getComputedStyle(element, null).overflow === "visible";
        return hasScrollableSpace && !hasVisibleOverflow;
    }

    private isScriptTag(element: HTMLElement): boolean {
        return element.nodeName === "SCRIPT";
    }

    private findScrollableChild(inputElement: HTMLElement): HTMLElement {
        let scrollableElement: HTMLElement;
        let i = 0;
        if (this.isScriptTag(inputElement)) {
            return null;
        }
        while (scrollableElement == null && i < inputElement.childElementCount) {
            let element = <HTMLElement>inputElement.children[i];
            if (this.isScrollable(element)) {
                scrollableElement = element;
                return element;
            }
            scrollableElement = this.findScrollableChild(element);
            i++;
        }
        return scrollableElement;
    }
}