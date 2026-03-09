import { Component, HostListener, inject } from "@angular/core";
import { MatToolbar } from "@angular/material/toolbar";
import { RouterOutlet } from "@angular/router";
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
  imports: [MatToolbar, RouterOutlet, MainMenuComponent, SearchComponent]
})
export class AppRootComponent {
  public isScrolled = false;

  public readonly resources = inject(ResourcesService);
  private readonly runningContextService = inject(RunningContextService)
  private readonly store = inject(Store);

  @HostListener("window:scroll", [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  public isIFrame() {
    return this.runningContextService.isIFrame;
  }

  public isHome() {
    const currentUrl = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.currentUrl);
    return currentUrl === RouteStrings.ROUTE_ROOT || currentUrl === RouteStrings.ROUTE_LANDING || currentUrl === RouteStrings.ROUTE_ABOUT;
  }
}
