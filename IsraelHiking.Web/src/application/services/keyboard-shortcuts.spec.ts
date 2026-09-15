import { describe, beforeEach, afterEach, it, expect, vi } from "vitest";

import { handleShortcutKey, isCtrlOrMeta, isMapPopupOpen } from "./keyboard-shortcuts";
import type { AnalyticsService } from "./analytics.service";

describe("Keyboard shortcuts", () => {
    const keyPress = (init: KeyboardEventInit, target?: HTMLElement) => {
        const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
        if (target != null) {
            Object.defineProperty(event, "target", { value: target });
        }
        return event;
    };

    const textField = () => document.createElement("input");

    /** A handler that claims every key press, so a test can tell whether it was consulted at all */
    const claimingHandler = () => vi.fn((): string | null => "Some shortcut");

    describe("isCtrlOrMeta", () => {
        it("should accept CTRL, for Windows and Linux", () => {
            expect(isCtrlOrMeta(keyPress({ key: "z", ctrlKey: true }))).toBe(true);
        });

        it("should accept CMD, for macOS", () => {
            expect(isCtrlOrMeta(keyPress({ key: "z", metaKey: true }))).toBe(true);
        });

        it("should not accept a bare key press", () => {
            expect(isCtrlOrMeta(keyPress({ key: "z" }))).toBe(false);
        });
    });

    describe("isMapPopupOpen", () => {
        afterEach(() => document.querySelectorAll(".maplibregl-popup").forEach(element => element.remove()));

        it("should report no popup when none is open", () => {
            expect(isMapPopupOpen()).toBe(false);
        });

        it("should report a popup once maplibre opened one", () => {
            const popup = document.createElement("div");
            popup.className = "maplibregl-popup";
            document.body.appendChild(popup);

            expect(isMapPopupOpen()).toBe(true);
        });
    });

    describe("handleShortcutKey", () => {
        let analyticsService: AnalyticsService;
        let trackEvent: ReturnType<typeof vi.fn>;
        let handler: ReturnType<typeof claimingHandler>;

        beforeEach(() => {
            trackEvent = vi.fn();
            analyticsService = { trackEvent } as unknown as AnalyticsService;
            handler = claimingHandler();
        });

        it("should report and swallow a key press the handler claimed", () => {
            const event = keyPress({ key: "z", ctrlKey: true });

            handleShortcutKey(event, analyticsService, () => "Undo");

            expect(trackEvent).toHaveBeenCalledWith("Keyboard Shortcuts", "Undo");
            expect(event.defaultPrevented).toBe(true);
        });

        it("should leave a key press the handler did not claim alone", () => {
            const event = keyPress({ key: "q" });

            handleShortcutKey(event, analyticsService, () => null);

            expect(trackEvent).not.toHaveBeenCalled();
            expect(event.defaultPrevented).toBe(false);
        });

        it("should not call the handler while the user is typing in a text field", () => {
            handleShortcutKey(keyPress({ key: "Delete" }, textField()), analyticsService, handler);

            expect(handler).not.toHaveBeenCalled();
            expect(trackEvent).not.toHaveBeenCalled();
        });

        it("should not call the handler while the user is typing in a contenteditable", () => {
            const editable = document.createElement("div");
            // Both jsdom and the browser derive isContentEditable from layout, so set it outright
            Object.defineProperty(editable, "isContentEditable", { value: true });

            handleShortcutKey(keyPress({ key: "Delete" }, editable), analyticsService, handler);

            expect(handler).not.toHaveBeenCalled();
        });

        it("should call the handler for ENTER and ESC even from inside a text field", () => {
            handleShortcutKey(keyPress({ key: "Enter" }, textField()), analyticsService, handler);
            handleShortcutKey(keyPress({ key: "Escape" }, textField()), analyticsService, handler);

            expect(handler).toHaveBeenCalledTimes(2);
        });

        it("should call the handler for CTRL + DEL from inside a text field, a dialog focuses its first field", () => {
            handleShortcutKey(keyPress({ key: "Delete", ctrlKey: true }, textField()), analyticsService, handler);

            expect(handler).toHaveBeenCalledOnce();
        });

        it("should call the handler for any key press outside a text field", () => {
            handleShortcutKey(keyPress({ key: "Delete" }, document.createElement("div")), analyticsService, handler);

            expect(handler).toHaveBeenCalledOnce();
        });
    });
});
