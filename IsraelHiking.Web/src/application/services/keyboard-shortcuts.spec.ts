import { describe, afterEach, it, expect } from "vitest";

import { isCtrlOrMeta, isMapPopupOpen, isTypingInTextField } from "./keyboard-shortcuts";

describe("Keyboard shortcuts", () => {
    const keyPress = (init: KeyboardEventInit, target?: HTMLElement) => {
        const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
        if (target != null) {
            Object.defineProperty(event, "target", { value: target });
        }
        return event;
    };

    const textField = () => document.createElement("input");

    describe("isCtrlOrMeta", () => {
        it("should accept CTRL", () => {
            expect(isCtrlOrMeta(keyPress({ key: "z", ctrlKey: true }))).toBe(true);
        });

        it("should accept CMD", () => {
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

        it("should report an open popup", () => {
            const popup = document.createElement("div");
            popup.className = "maplibregl-popup";
            document.body.appendChild(popup);

            expect(isMapPopupOpen()).toBe(true);
        });
    });

    describe("isTypingInTextField", () => {
        it("should claim a key press for a text field", () => {
            expect(isTypingInTextField(keyPress({ key: "Delete" }, textField()))).toBe(true);
        });

        it("should claim a key press for a contenteditable", () => {
            const editable = document.createElement("div");
            Object.defineProperty(editable, "isContentEditable", { value: true });

            expect(isTypingInTextField(keyPress({ key: "Delete" }, editable))).toBe(true);
        });

        it("should leave ENTER and ESC to the shortcuts", () => {
            expect(isTypingInTextField(keyPress({ key: "Enter" }, textField()))).toBe(false);
            expect(isTypingInTextField(keyPress({ key: "Escape" }, textField()))).toBe(false);
        });

        it("should leave CTRL + DEL to the shortcuts", () => {
            expect(isTypingInTextField(keyPress({ key: "Delete", ctrlKey: true }, textField()))).toBe(false);
        });

        it("should leave a key press outside a text field to the shortcuts", () => {
            expect(isTypingInTextField(keyPress({ key: "Delete" }, document.createElement("div")))).toBe(false);
        });
    });
});
