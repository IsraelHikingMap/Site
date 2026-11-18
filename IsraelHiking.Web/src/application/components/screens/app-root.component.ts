import { Component, HostListener, inject, viewChild, ElementRef, DestroyRef, afterNextRender, DOCUMENT, signal, computed } from "@angular/core";
import { MatToolbar } from "@angular/material/toolbar";
import { RouterLink, RouterOutlet } from "@angular/router";
import { Store } from "@ngxs/store";

import { MainMenuComponent } from "../main-menu.component";
import { SearchComponent } from "../search.component";
import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";
import { RouteStrings } from "../../services/hash.service";
import type { ApplicationState } from "../../models";

@Component({
    selector: "app-root",
    templateUrl: "./app-root.component.html",
    styleUrls: ["./app-root.component.scss"],
    imports: [MatToolbar, RouterLink, RouterOutlet, MainMenuComponent, SearchComponent]
})
export class AppRootComponent {
    public readonly isScrolled = signal(false);

    public readonly resources = inject(ResourcesService);
    private readonly runningContextService = inject(RunningContextService)
    private readonly store = inject(Store);
    private readonly document = inject(DOCUMENT);
    private readonly destroyRef = inject(DestroyRef);
    private readonly toolbar = viewChild.required("toolbar", { read: ElementRef });

    private readonly currentUrl = this.store.selectSignal((s: ApplicationState) => s.inMemoryState.currentUrl);

    public readonly isHome = computed(() =>
        this.currentUrl() === RouteStrings.ROUTE_ROOT ||
        this.currentUrl() === RouteStrings.ROUTE_LANDING ||
        this.currentUrl() === RouteStrings.ROUTE_ABOUT);

    /**
     * The search is shown on the screens that are about the map. The text screens - settings, faq,
     * attribution and privacy policy - show the logo instead, since searching for a place is not what a
     * user who got there is after, and the floating search over a page of text looks out of place.
     */
    public readonly isSearchShown = computed(() => {
        const path = (this.currentUrl() ?? "").split("?")[0];
        return !this.isHome() &&
            ![RouteStrings.ROUTE_SETTINGS, "/attribution", "/privacy-policy"].some(r => path.startsWith(r)) &&
            !path.endsWith("/faq");
    });

    /**
     * Over a map the toolbar has no background of its own: the search and the menu float on it as pills,
     * and the space between them lets clicks through to the map underneath.
     */
    public readonly isFloating = computed(() => this.isSearchShown() || this.isIFrame());

    public readonly toolbarClass = computed(() => {
        if (this.isHome()) {
            return this.isScrolled()
                ? "transition-all duration-300 text-white! bg-black/40! backdrop-blur-md"
                : "transition-all duration-300 text-white! bg-transparent!";
        }
        return this.isFloating() ? "pointer-events-none bg-transparent! [--toolbar-side-gap:10px]!" : "shadow-sm";
    });

    constructor() {
        afterNextRender(() => {
            const element = this.toolbar().nativeElement as HTMLElement;
            // Set the toolbar height as a CSS variable so the map controls can offset below it
            const update = () => this.document.documentElement.style
                .setProperty("--app-toolbar-height", `${element.offsetHeight}px`);
            update();
            const observer = new ResizeObserver(update);
            observer.observe(element);
            this.destroyRef.onDestroy(() => observer.disconnect());
        });
    }

    @HostListener("window:scroll", [])
    onWindowScroll() {
        this.isScrolled.set(typeof window !== "undefined" && window.scrollY > 50);
    }

    public isIFrame() {
        return this.runningContextService.isIFrame;
    }
}
