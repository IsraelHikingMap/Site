/** The analytics category every keyboard shortcut is reported under */
export const SHORTCUT_ANALYTICS_CATEGORY = "Keyboard Shortcuts";

const KEYS_ALLOWED_WHILE_TYPING = ["Enter", "Escape"];

/** CTRL on Windows and Linux, CMD on macOS, so a shortcut works on either without sniffing the OS */
export function isCtrlOrMeta(event: KeyboardEvent): boolean {
    return event.ctrlKey || event.metaKey;
}

/** Maplibre has no API to ask, and the popups are spread over several components */
export function isMapPopupOpen(): boolean {
    return document.querySelector(".maplibregl-popup") != null;
}

function isTypingTarget(target: EventTarget): boolean {
    const element = target as HTMLElement;
    if (element?.isContentEditable) {
        return true;
    }
    return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.tagName === "SELECT";
}

/**
 * The key press belongs to a text field and no shortcut should claim it. CTRL/CMD + DEL is the
 * exception, since a dialog focuses its first field and DEL would never reach a shortcut otherwise.
 */
export function isTypingInTextField(event: KeyboardEvent): boolean {
    if (!isTypingTarget(event.target)) {
        return false;
    }
    return !KEYS_ALLOWED_WHILE_TYPING.includes(event.key) && !(event.key === "Delete" && isCtrlOrMeta(event));
}
