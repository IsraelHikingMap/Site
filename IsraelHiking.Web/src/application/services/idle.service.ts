import { Service } from "@angular/core";
import { Subject } from "rxjs";

/**
 * Pointer events cover mouse, touch and pen with a single set of listeners, so there's no need for the
 * legacy `mousedown`/`mousemove`/`touchstart`/`touchmove` pairs, nor for `DOMMouseScroll`/`mousewheel`.
 */
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "scroll"] as const;

const IDLE_TIME_MILLISECONDS = 30_000;

/** `pointermove` fires at the display's refresh rate, there's no point in restarting the timer that often. */
const ACTIVITY_THROTTLE_MILLISECONDS = 1_000;

/**
 * Emits when the user stops interacting with the app for a while, and when they interact with it again.
 * A hand rolled replacement for `@ng-idle/core`, which relies on zone.js and polls once a second.
 */
@Service()
export class IdleService {
    public readonly onIdleStart = new Subject<void>();
    public readonly onIdleEnd = new Subject<void>();

    private idle = false;
    private lastActivity = 0;
    private idleHandle: ReturnType<typeof setTimeout> | null = null;
    private abortController: AbortController | null = null;

    /**
     * Starts watching for user inactivity. Calling this while already watching resets the idle timer.
     */
    public watch(): void {
        this.stop();
        this.abortController = new AbortController();
        for (const eventName of ACTIVITY_EVENTS) {
            // Capture phase, since components in the tree - the map for one - stop the propagation of these events,
            // passive since this listener never calls `preventDefault()` and should not delay scrolling.
            document.addEventListener(eventName, () => this.onActivity(), {
                capture: true,
                passive: true,
                signal: this.abortController.signal
            });
        }
        this.restartIdleTimer();
    }

    /**
     * Stops watching for user inactivity and resets the idle state without emitting.
     */
    public stop(): void {
        this.abortController?.abort();
        this.abortController = null;
        this.clearIdleTimer();
        this.idle = false;
        this.lastActivity = 0;
    }

    public isIdling(): boolean {
        return this.idle;
    }

    private onActivity(): void {
        const now = performance.now();
        if (this.idle) {
            this.idle = false;
            this.onIdleEnd.next();
        } else if (now - this.lastActivity < ACTIVITY_THROTTLE_MILLISECONDS) {
            return;
        }
        this.lastActivity = now;
        this.restartIdleTimer();
    }

    private restartIdleTimer(): void {
        this.clearIdleTimer();
        this.idleHandle = setTimeout(() => {
            this.idleHandle = null;
            this.idle = true;
            this.onIdleStart.next();
        }, IDLE_TIME_MILLISECONDS);
    }

    private clearIdleTimer(): void {
        if (this.idleHandle !== null) {
            clearTimeout(this.idleHandle);
            this.idleHandle = null;
        }
    }
}
