import { Component, inject } from '@angular/core';
import { MatToolbar } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';

import { MainMenuComponent } from '../main-menu.component';
import { SearchComponent } from '../search.component';
import { ResourcesService } from '../../services/resources.service';

@Component({
  selector: 'app-root',
  templateUrl: './app-root.component.html',
  styleUrls: ['./app-root.component.scss'],
  imports: [MatToolbar, RouterOutlet, MainMenuComponent, SearchComponent]
})
export class AppRootComponent {
  public readonly resources = inject(ResourcesService);

}
