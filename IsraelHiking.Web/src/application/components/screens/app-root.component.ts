import { Component, inject } from '@angular/core';
import { MatToolbar } from '@angular/material/toolbar';
import { MatButton } from '@angular/material/button';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { RouterLink, RouterOutlet } from '@angular/router';

import { ResourcesService } from '../../services/resources.service';
import { SearchComponent } from '../search.component';
import { MatFormField, MatInput } from '@angular/material/input';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  templateUrl: './app-root.component.html',
  styleUrls: ['./app-root.component.scss'],
  imports: [MatToolbar, MatButton, MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger, RouterOutlet, RouterLink, SearchComponent, ReactiveFormsModule, MatFormField, MatInput]
})
export class AppRootComponent {
  public readonly resources = inject(ResourcesService);

  public searchFrom = new FormControl('');
}
