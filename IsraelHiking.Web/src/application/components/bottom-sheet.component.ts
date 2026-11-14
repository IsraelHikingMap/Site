import { Component, ElementRef, Injector, afterNextRender, inject, input, model, output } from "@angular/core";
import { CdkDrag, CdkDragEnd, CdkDragHandle, CdkDragMove, DragRef, Point } from "@angular/cdk/drag-drop";

/** How far the sheet has to be dragged, in pixels, for the release to count as a swipe. */
const SWIPE_THRESHOLD = 40;

/**
 * A panel at the bottom of a phone's screen, dragged by the bar at its top: it slides in when created,
 * a swipe down minimizes it - when it is minimizable - or closes it, and a swipe up restores it.
 * Closing is up to the owner, which removes the sheet on `closed`, and the sheet slides out on its way.
 */
@Component({
    selector: "bottom-sheet",
    templateUrl: "./bottom-sheet.component.html",
    imports: [CdkDrag, CdkDragHandle],
    host: {
        "class": "fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-3xl bg-surface pb-safe px-safe shadow-lg transition-[transform,max-height] duration-300",
        "[class]": "minimized() ? 'max-h-[15vh]' : 'max-h-[55vh]'",
        "animate.enter": "animate-sheet-in",
        "animate.leave": "animate-sheet-out"
    }
})
export class BottomSheetComponent {
    public readonly minimizable = input(false);
    public readonly minimized = model(false);
    public readonly closed = output();

    private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly injector = inject(Injector);
    private startHeight = 0;
    private grabOffset: number = null;

    /** Keeps the sheet from being pulled above where it rests, which would open a gap under it. */
    protected readonly keepBelowStart = (point: Point, _drag: DragRef, start: DOMRect, pickup: Point): Point =>
        ({ x: point.x - pickup.x, y: Math.max(point.y - pickup.y, start.top) });

    /** Lets the sheet follow the finger without lagging behind its own transitions. */
    public onDragStarted() {
        this.element.nativeElement.style.setProperty("transition", "none", "important");
        this.startHeight = this.element.nativeElement.offsetHeight;
        this.grabOffset = null;
    }

    /**
     * A minimized sheet can not move up, so dragging it up grows it instead - its top stays under the
     * finger where it was grabbed. The finger's position is read from the browser's event, since the cdk
     * reports both the distance and the pointer after keeping the sheet from moving up.
     */
    public onDragMoved(event: CdkDragMove) {
        if (!this.minimized()) {
            return;
        }
        const sheet = this.element.nativeElement;
        const rect = sheet.getBoundingClientRect();
        const pointerY = "touches" in event.event ? event.event.touches[0].clientY : event.event.clientY;
        this.grabOffset ??= pointerY - rect.top;
        const height = rect.bottom - (pointerY - this.grabOffset);
        sheet.style.maxHeight = `${Math.max(this.startHeight, height)}px`;
    }

    /**
     * Hands the sheet back to its transitions, which ease it into place - once the new state has rendered,
     * so a sheet grown by the finger grows on from there. When the swipe closes it, the distance it was
     * dragged is kept so `animate-sheet-out` carries on from there instead of from the top.
     */
    public onDragEnded(event: CdkDragEnd) {
        const sheet = this.element.nativeElement;
        sheet.style.removeProperty("transition");
        if (event.distance.y > SWIPE_THRESHOLD) {
            if (this.minimizable() && !this.minimized()) {
                this.minimized.set(true);
            } else {
                sheet.style.setProperty("--sheet-offset", `${event.distance.y}px`);
                this.closed.emit();
            }
        } else if (event.distance.y < -SWIPE_THRESHOLD) {
            this.minimized.set(false);
        }
        event.source.reset();
        afterNextRender(() => sheet.style.removeProperty("max-height"), { injector: this.injector });
    }
}
