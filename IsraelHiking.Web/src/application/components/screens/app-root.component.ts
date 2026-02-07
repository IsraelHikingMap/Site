import { Component, HostListener, inject } from "@angular/core";
import { MatToolbar } from "@angular/material/toolbar";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";

import { MainMenuComponent } from "../main-menu.component";
import { SearchComponent } from "../search.component";
import { ResourcesService } from "../../services/resources.service";

@Component({
  selector: "app-root",
  templateUrl: "./app-root.component.html",
  styleUrls: ["./app-root.component.scss"],
  imports: [MatToolbar, RouterOutlet, MainMenuComponent, SearchComponent]
})
export class AppRootComponent {
  public isHome = false;
  public isScrolled = false;

  public readonly resources = inject(ResourcesService);
  private readonly router = inject(Router);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.isHome = event.urlAfterRedirects === "/" || event.urlAfterRedirects === "/landing" || event.urlAfterRedirects === "/about";
      }
    });
  }

  @HostListener("window:scroll", [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

}
