import { describe, beforeEach, afterEach, it, expect, vi } from "vitest";
import { IdleService } from "./idle.service";

const IDLE_TIME_MILLISECONDS = 30_000;

describe("IdleService", () => {
    let service: IdleService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new IdleService();
    });

    afterEach(() => {
        service.stop();
        vi.useRealTimers();
    });

    it("should not report idle before the idle time has passed", () => {
        const idleStart = vi.fn();
        service.onIdleStart.subscribe(idleStart);
        service.watch();

        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS - 1);

        expect(idleStart).not.toHaveBeenCalled();
        expect(service.isIdling()).toBe(false);
    });

    it("should report idle once the idle time has passed", () => {
        const idleStart = vi.fn();
        service.onIdleStart.subscribe(idleStart);
        service.watch();

        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS);

        expect(idleStart).toHaveBeenCalledOnce();
        expect(service.isIdling()).toBe(true);
    });

    it("should restart the idle timer when the user interacts", () => {
        const idleStart = vi.fn();
        service.onIdleStart.subscribe(idleStart);
        service.watch();

        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS - 1);
        document.dispatchEvent(new KeyboardEvent("keydown"));
        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS - 1);

        expect(idleStart).not.toHaveBeenCalled();
    });

    it("should report the end of idle when the user interacts after being idle", () => {
        const idleEnd = vi.fn();
        service.onIdleEnd.subscribe(idleEnd);
        service.watch();

        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS);
        document.dispatchEvent(new KeyboardEvent("keydown"));

        expect(idleEnd).toHaveBeenCalledOnce();
        expect(service.isIdling()).toBe(false);
    });

    it("should report idle again after the user went idle, interacted and stopped interacting", () => {
        const idleStart = vi.fn();
        service.onIdleStart.subscribe(idleStart);
        service.watch();

        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS);
        document.dispatchEvent(new KeyboardEvent("keydown"));
        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS);

        expect(idleStart).toHaveBeenCalledTimes(2);
    });

    it("should see events that were stopped from propagating", () => {
        const idleStart = vi.fn();
        service.onIdleStart.subscribe(idleStart);
        service.watch();
        const element = document.createElement("div");
        document.body.appendChild(element);
        element.addEventListener("keydown", (e) => e.stopPropagation());

        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS - 1);
        element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS - 1);
        element.remove();

        expect(idleStart).not.toHaveBeenCalled();
    });

    it("should not report idle after stopping", () => {
        const idleStart = vi.fn();
        service.onIdleStart.subscribe(idleStart);
        service.watch();

        service.stop();
        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS);

        expect(idleStart).not.toHaveBeenCalled();
    });

    it("should not report the end of idle when stopping while idle", () => {
        const idleEnd = vi.fn();
        service.onIdleEnd.subscribe(idleEnd);
        service.watch();

        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS);
        service.stop();

        expect(idleEnd).not.toHaveBeenCalled();
        expect(service.isIdling()).toBe(false);
    });

    it("should stop listening to events after stopping", () => {
        const idleEnd = vi.fn();
        service.onIdleEnd.subscribe(idleEnd);
        service.watch();

        vi.advanceTimersByTime(IDLE_TIME_MILLISECONDS);
        service.stop();
        document.dispatchEvent(new KeyboardEvent("keydown"));

        expect(idleEnd).not.toHaveBeenCalled();
    });
});
