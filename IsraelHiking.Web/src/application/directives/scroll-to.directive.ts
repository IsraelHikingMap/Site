import { Directive, HostListener, input } from "@angular/core";

@Directive({
    selector: "[scrollToOnClick]"
})
export class ScrollToDirective {
    public readonly targetId = input<string>(undefined, { alias: "scrollToOnClick" });
    public readonly offset = input(0, { alias: "scrollToOnClickOffset" });

    @HostListener("click")
    onClick(): void {
        if (!this.targetId()) {
            console.warn("targetId parameter is missing");
            return;
        }
        ScrollToDirective.scrollTo(this.targetId(), this.offset())
    }

    /**
     * This allows scrolling to the relevant element without using the directive.
     * This is helpfull when there's a spcific event that happens that requires scrolling.
     * When no scrollable parent is found - the body of this app is positioned rather than scrollable,
     * so a target that is not inside a scrolling container of its own has none - the element is asked
     * to bring itself into view instead, which ignores the offset.
     * @param targetId - the ID of the element to scroll to
     * @param offset - the scroll offset, positive makes the scrolling move the "screen" lower.
     */
    public static scrollTo(targetId: string, offset = 0) {
        const targetElement = document.getElementById(targetId);
        if (!targetElement) {
            console.warn(`Scroll target element with ID "${targetId}" not found.`);
            return;
        }
        const container = ScrollToDirective.getFirstScrollableParent(targetElement);
        if (container == null) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();

        const elementPositionTop = targetRect.top - containerRect.top + container.scrollTop;
        const offsetPosition = elementPositionTop - offset;

        container.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }

    /**
     * Find the first scrollable parent Node of a given
     * Element. The DOM Tree gets searched upwards
     * to find this first scrollable parent. Parents might
     * be ignored by CSS styles applied to the HTML Element.
     * Copies from: https://github.com/nicky-lenaers/ngx-scroll-to/blob/8e04b7a865505c7228532dd61344e4499173d2c1/projects/ngx-scroll-to/src/lib/scroll-to.service.ts#L254
     *
     * @param nativeElement     The Element to search the DOM Tree upwards from
     * @returns                 The first scrollable parent HTML Element
     */
    private static getFirstScrollableParent(nativeElement: HTMLElement): HTMLElement {

        let style: CSSStyleDeclaration = window.getComputedStyle(nativeElement);

        const overflowRegex = /(auto|scroll|overlay)/;

        if (style.position === "fixed") {
            return null;
        }

        let parent = nativeElement;
        while (parent.parentElement) {
            parent = parent.parentElement;
            style = window.getComputedStyle(parent);

            if (style.position === "absolute"
                || style.overflow === "hidden"
                || style.overflowY === "hidden") {
                continue;
            }

            if (overflowRegex.test(style.overflow + style.overflowY)
                || parent.tagName === "BODY") {
                return parent;
            }
        }

        return null;
    }
}