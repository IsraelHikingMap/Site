import { Component, inject, model, signal, OnInit, computed } from "@angular/core";
import { MatSelectChange, MatSelect } from "@angular/material/select";
import { Dir } from "@angular/cdk/bidi";
import { NgClass } from "@angular/common";
import { MatCard, MatCardHeader, MatCardTitle } from "@angular/material/card";
import { MatFormField, MatLabel, MatSuffix } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatTooltip } from "@angular/material/tooltip";
import { FormsModule } from "@angular/forms";
import { MatIconButton, MatButton } from "@angular/material/button";
import { MatOption } from "@angular/material/core";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { validate as validateUuid } from "uuid";

import { ImageScrollerComponent } from "./image-scroller.component";
import { PoiService, SelectableCategory } from "../../../services/poi.service";
import { ResourcesService } from "../../../services/resources.service";
import { SidebarService } from "../../../services/sidebar.service";
import { ToastService } from "../../../services/toast.service";
import { ScrollToDirective } from "../../../directives/scroll-to.directive";
import { POINTS_OF_INTEREST_CATEGORIES } from "../../../reducers/initial-state";
import type { EditablePublicPointData, IconColorLabel } from "../../../models";

@Component({
    selector: "public-poi-edit",
    templateUrl: "./public-poi-edit.component.html",
    imports: [Dir, MatCard, MatCardHeader, MatCardTitle, NgClass, MatFormField, MatLabel, MatInput, FormsModule, ImageScrollerComponent, MatIconButton, MatSuffix, MatButton, MatSelect, MatOption, MatTooltip, MatCheckbox, MatProgressSpinner, ScrollToDirective]
})
export class PublicPointOfInterestEditComponent implements OnInit {

    public readonly info = model<EditablePublicPointData>();

    public isLoading = signal(false);
    public readonly categories = signal<SelectableCategory[]>([]);
    public readonly selectedCategory = signal<SelectableCategory>(null);
    public readonly updateLocation = signal(false);

    public readonly resources = inject(ResourcesService);

    private readonly poiService: PoiService = inject(PoiService);
    private readonly sidebarService = inject(SidebarService);
    private readonly toastService = inject(ToastService);

    public readonly isPoint = computed(() => this.info != null && this.info().isPoint);

    private initializeCategories() {
        this.categories.set(structuredClone(POINTS_OF_INTEREST_CATEGORIES) as SelectableCategory[]);
    }

    public ngOnInit() {
        this.initializeCategories();
        if (this.info().urls.length === 0) {
            this.addEmptyUrl();
        }
        let selectedIcon: IconColorLabel = null;
        let selectedCategory: SelectableCategory = null;
        for (const category of this.categories()) {
            const icon = category.selectableItems.find(iconToFind => iconToFind.icon === this.info().icon);
            if (icon) {
                selectedCategory = category;
                selectedIcon = icon;
                break;
            }
        }

        if (selectedCategory == null) {
            selectedCategory = this.categories().find(categoryToFind => categoryToFind.name === "Other");
        }

        if (this.isNew() && selectedIcon == null) {
            selectedIcon = selectedCategory.selectableItems[0];
        } else if (!this.isNew() && selectedIcon == null) {
            selectedIcon = { icon: this.info().icon, color: "black", label: this.resources.other } as IconColorLabel;
            const previousCategory = selectedCategory;
            selectedCategory = { ...previousCategory, selectableItems: [...previousCategory.selectableItems, selectedIcon] };
            this.categories.update(categories => categories.map(c => c === previousCategory ? selectedCategory : c));
        }
        this.selectCategory({ value: selectedCategory } as MatSelectChange);
        this.selectIcon(selectedIcon);
    }

    public selectCategory(e: MatSelectChange) {
        this.selectedCategory.set(e.value);
        if (this.selectedCategory().selectedIcon == null) {
            this.selectIcon(this.selectedCategory().selectableItems[0]);
        }
    }

    public selectIcon(icon: IconColorLabel) {
        const previousCategory = this.selectedCategory();
        const categoryWithIcon = { ...previousCategory, selectedIcon: icon };
        this.categories.update(categories => categories.map(c => c === previousCategory ? categoryWithIcon : c));
        this.selectedCategory.set(categoryWithIcon);
        this.info.update(info => ({ ...info, icon: icon.icon }));
    }

    public addEmptyUrl() {
        this.info.update(info => ({ ...info, urls: [...info.urls, ""] }));
    }

    public removeUrl(i: number) {
        this.info.update(info => ({ ...info, urls: info.urls.filter((_, index) => index !== i) }));
    }

    public updateTitle(title: string) {
        this.info.update(info => ({ ...info, title }));
    }

    public updateDescription(description: string) {
        this.info.update(info => ({ ...info, description }));
    }

    public updateImages(imagesUrls: string[]) {
        this.info.update(info => ({ ...info, imagesUrls }));
    }

    public updateUrl(i: number, url: string) {
        this.info.update(info => ({ ...info, urls: info.urls.map((u, index) => index === i ? url : u) }));
    }

    public close() {
        this.sidebarService.hide();
    }

    public async save() {
        this.isLoading.set(true);
        try {
            if (this.isNew()) {
                await this.poiService.addComplexPoi(this.info());
            } else {
                await this.poiService.updateComplexPoi(this.info(), this.updateLocation());
            }
            this.toastService.success(this.resources.dataUpdatedSuccessfullyItWillTakeTimeToSeeIt);
            this.close();
        } catch {
            this.toastService.confirm({ message: this.resources.unableToSaveData, type: "Ok" });
        } finally {
            this.isLoading.set(false);
        }
    }

    private isNew(): boolean {
        return !this.info().id || validateUuid(this.info().id);
    }
}
