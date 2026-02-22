import { Component, HostListener, inject } from "@angular/core";
import { MatToolbar } from "@angular/material/toolbar";
import { RouterOutlet } from "@angular/router";

import { MainMenuComponent } from "../main-menu.component";
import { SearchComponent } from "../search.component";
import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";
import { HashService } from "../../services/hash.service";

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
  private readonly hashService = inject(HashService);

  @HostListener("window:scroll", [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  public isIFrame() {
    return this.runningContextService.isIFrame;
  }

  public isHome() {
    return this.hashService.isHome();
  }

}
