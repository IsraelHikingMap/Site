import { describe, it, expect } from "vitest";

import { isTypingInTextField } from "./keyboard-shortcuts";

describe("Keyboard shortcuts", () => {
    const keyPress = (init: KeyboardEventInit, target: HTMLElement) => {
        const event = new KeyboardEvent("keydown", init);
        Object.defineProperty(event, "target", { value: target });
        return event;
    };

    const textField = () => document.createElement("input");

    const contentEditable = () => {
        const editable = document.createElement("div");
        Object.defineProperty(editable, "isContentEditable", { value: true });
        return editable;
    };

    it("should claim a key press the user is typing", () => {
        expect(isTypingInTextField(keyPress({ key: "Delete" }, textField()))).toBe(true);
        expect(isTypingInTextField(keyPress({ key: "Delete" }, contentEditable()))).toBe(true);
    });

    it("should leave the keys a shortcut may need", () => {
        expect(isTypingInTextField(keyPress({ key: "Enter" }, textField()))).toBe(false);
        expect(isTypingInTextField(keyPress({ key: "Escape" }, textField()))).toBe(false);
        expect(isTypingInTextField(keyPress({ key: "Delete", ctrlKey: true }, textField()))).toBe(false);
        expect(isTypingInTextField(keyPress({ key: "Delete" }, document.createElement("div")))).toBe(false);
    });
});
