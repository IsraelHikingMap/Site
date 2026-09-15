import type { AnalyticsService } from "./analytics.service";

/** Every shortcut is reported under this category, so they can be looked at as a group */
const ANALYTICS_CATEGORY = "Keyboard Shortcuts";

/**
 * While the user is typing every key belongs to the text field - DEL should remove the character
 * after the caret and not the point being edited. These keys are the exception: they are the
 * "I'm done" and "never mind" of a form and are expected to work from inside a field.
 */
const KEYS_ALLOWED_WHILE_TYPING = ["Enter", "Escape"];

/**
 * Returns the name of the shortcut it handled, which is what shows up in analytics, or null when
 * the key press is none of this handler's business.
 */
export type ShortcutHandler = (event: KeyboardEvent) => string | null;

/**
 * CTRL on Windows and Linux, CMD on macOS. Accepting either keeps every shortcut working on all
 * platforms without having to sniff the OS.
 */
export function isCtrlOrMeta(event: KeyboardEvent): boolean {
    return event.ctrlKey || event.metaKey;
}

/**
 * A map popup is open, i.e. something nearer to the user than the map itself may want this key
 * press. There is no API to ask maplibre, and the popups are spread over several components, so
 * the class it puts on every popup it opens is the one thing they all have in common.
 */
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
 * The boilerplate every `window:keydown` host listener in the app shares: leave the key press alone
 * when the user is typing, then report and swallow whatever shortcut the handler claims.
 *
 * A dialog usually focuses its first field, so a shortcut that is only available while not typing
 * is a shortcut that can never be used there. CTRL/CMD + DEL is the way out: it is unambiguous
 * enough to take over the text field's delete-next-word.
 */
export function handleShortcutKey(event: KeyboardEvent, analyticsService: AnalyticsService, handler: ShortcutHandler): void {
    const isTyping = isTypingTarget(event.target)
        && !KEYS_ALLOWED_WHILE_TYPING.includes(event.key)
        && !(event.key === "Delete" && isCtrlOrMeta(event));
    if (isTyping) {
        return;
    }
    const shortcutName = handler(event);
    if (shortcutName == null) {
        return;
    }
    analyticsService.trackEvent(ANALYTICS_CATEGORY, shortcutName);
    event.preventDefault();
}
