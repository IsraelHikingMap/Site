import { Component, HostListener, inject, signal } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";


import { ResourcesService } from "../../services/resources.service";
import { isTypingInTextField, SHORTCUT_ANALYTICS_CATEGORY } from "../../services/keyboard-shortcuts";
import { AnalyticsService } from "../../services/analytics.service";

export type ConfirmType = "YesNo" | "OkCancel" | "Ok" | "Custom";

@Component({
    selector: "confirm-dialog",
    templateUrl: "confirm-dialog.component.html",
    imports: [Dir, MatButton]
})
export class ConfirmDialogComponent {
    // Only invoked from (click), never rendered, so they need no change notification.
    public confirmAction: () => void;
    public declineAction: () => void;

    public readonly hasTwoButtons = signal(false);
    public readonly confirmMessage = signal<string>(null);
    public readonly confirmIcon = signal<string>(null);
    public readonly confirmButtonText = signal<string>(null);
    public readonly declineIcon = signal<string>(null);
    public readonly declineButtonText = signal<string>(null);

    public readonly resources = inject(ResourcesService);

    private readonly analyticsService = inject(AnalyticsService);

    public constructor() {
        this.confirmAction = () => { throw new Error("Confirm action method must be provided!"); };
        this.declineAction = () => { throw new Error("Decline action method must be provided!"); };
    }

    @HostListener("window:keydown", ["$event"])
    public onConfirmShortcutKeys(event: KeyboardEvent): void {
        if (isTypingInTextField(event)) {
            return;
        }
        const shortcutName = this.confirmOrDecline(event);
        if (shortcutName == null) {
            return;
        }
        this.analyticsService.trackEvent(SHORTCUT_ANALYTICS_CATEGORY, shortcutName);
        event.preventDefault();
    }

    private confirmOrDecline(event: KeyboardEvent): string | null {
        if (event.key === "Enter") {
            this.confirmAction();
            return "Confirm";
        }
        if (event.key === "Escape") {
            this.declineAction();
            return "Decline";
        }
        return null;
    }
}
