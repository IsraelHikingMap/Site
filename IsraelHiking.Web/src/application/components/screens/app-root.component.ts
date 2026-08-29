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
     * The search is shown on the screens that are about the map. The settings, which are about the app
     * itself, show the logo instead, since searching for a place is not what a user who got there is
     * after - and the search does not leave the menu room to breathe on a narrow screen.
     */
    public readonly isSearchShown = computed(() =>
        !this.isHome() && !(this.currentUrl() ?? "").startsWith(RouteStrings.ROUTE_SETTINGS));

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
