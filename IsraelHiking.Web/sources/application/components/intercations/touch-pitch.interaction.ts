import { Map, MapTouchEvent, Point } from "mapbox-gl";

export class TouchPitchInteraction {
    /**
     * min x distance to recognize pitch gesture
     */
    private static readonly MIN_DIFF_X = 55;
    /**
     * max x distance to recognize pitch gesture -
     * this is in order to allow rotate when the fingers are spread apart enough
     * and both have the "same" y value
     */
    private static readonly MAX_DIFF_X = 200;
    /**
     *  max y distance to recognize pitch gesture
     */
    private static readonly MAX_DIFF_Y = 100;
    /**
     * min distance threshold the fingers drifted from the original touch -
     * this is in order to recognize zoom gesture
     */
    private static readonly MIN_DIFF = 30;
    /**
     * delay for pitch, in case it's a zoom gesture
     */
    private static readonly DELAY = 160;

    private startEventData: MapTouchEvent;
    private point: Point;
    private pitch: number;
    private startTiming: number;
    private startDistance: number;

    constructor(private readonly map: Map) {
        this.startEventData = null;
        this.point = null;
        this.pitch = null;
        this.startDistance = null;
        this.startTiming = null;
    }

    public enable() {
        this.map.on("touchstart", (touchEvent: MapTouchEvent) => {
            this.handleTouchStart(touchEvent);
        });
        this.map.on("touchmove", (touchEvent: MapTouchEvent) => {
            this.handleTouchMove(touchEvent);
        });
        this.map.on("touchend", () => {
            this.resetInteractions();
        });
        this.map.on("touchcancel", () => {
            this.resetInteractions();
        });
    }

    private handleTouchStart(touchEvent: MapTouchEvent) {
        if (touchEvent.points.length !== 2) {
            return;
        }
        const diffY = touchEvent.points[0].y - touchEvent.points[1].y;
        const diffX = touchEvent.points[0].x - touchEvent.points[1].x;
        if (Math.abs(diffX) < TouchPitchInteraction.MIN_DIFF_X
            || Math.abs(diffY) > TouchPitchInteraction.MAX_DIFF_Y
            || Math.abs(diffX) > TouchPitchInteraction.MAX_DIFF_X) {
            return;
        }

        touchEvent.originalEvent.preventDefault(); // prevent browser refresh on pull down
        this.map.touchZoomRotate.disable(); // disable native touch controls
        this.map.dragPan.disable();
        this.point = touchEvent.point;
        this.pitch = this.map.getPitch();
        this.startTiming = Date.now();
        this.startDistance = Math.hypot(diffX, diffY);
        this.startEventData = touchEvent;
    }

    private handleTouchMove(touchEvent: MapTouchEvent) {
        if (this.point == null || this.pitch === null) {
            return;
        }
        touchEvent.preventDefault();
        touchEvent.originalEvent.preventDefault();

        const diffY = touchEvent.points[0].y - touchEvent.points[1].y;
        const diffX = touchEvent.points[0].x - touchEvent.points[1].x;
        const distance = Math.hypot(diffX, diffY);

        let isTimePassed = Date.now() - this.startTiming >= TouchPitchInteraction.DELAY;
        if (Math.abs(distance - this.startDistance) >= TouchPitchInteraction.MIN_DIFF) {
            let eventData = isTimePassed ? touchEvent.originalEvent : this.startEventData.originalEvent;
            this.resetInteractions();
            (this.map.touchZoomRotate as any).onStart(eventData);
            return;
        }

        if (isTimePassed) {
            const diff = (this.point.y - touchEvent.point.y) * 0.5;
            this.map.setPitch(this.pitch + diff);
        }
    }

    private resetInteractions() {
        if (this.point) {
            this.map.touchZoomRotate.enable();
            this.map.dragPan.enable();
        }
        this.point = null;
    }
}
