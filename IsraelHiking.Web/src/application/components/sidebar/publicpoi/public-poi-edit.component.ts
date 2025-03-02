import { Component, inject, input, OnInit } from "@angular/core";
import { MatSelectChange } from "@angular/material/select";

import { PoiService, ISelectableCategory } from "../../../services/poi.service";
import { ResourcesService } from "../../../services/resources.service";
import type { EditablePublicPointData, IconColorLabel } from "../../../models/models";

@Component({
    selector: "public-poi-edit",
    templateUrl: "./public-poi-edit.component.html",
    styleUrls: ["./public-poi-edit.component.scss"],
    standalone: false
})
export class PublicPointOfInterestEditComponent implements OnInit {

    public info = input<EditablePublicPointData>();

    public categories: ISelectableCategory[] = [];
    public selectedCategory: ISelectableCategory = null;

    public readonly resources = inject(ResourcesService);

    private readonly poiService: PoiService = inject(PoiService);

    private initializeCategories() {
        const categories = this.poiService.getSelectableCategories();
        for (const category of categories) {
            this.categories.push(category);
        }
    }

    public ngOnInit() {
        this.initializeCategories();
        if (this.info().urls.length === 0) {
            this.addEmptyUrl();
        }
        let selectedIcon = null;
        let selectedCategory = null;
        for (const category of this.categories) {
            const icon = category.icons.find(iconToFind => iconToFind.icon === this.info().icon);
            if (icon) {
                selectedCategory = category;
                selectedIcon = icon;
                break;
            }
        }

        if (selectedCategory == null) {
            selectedCategory = this.categories.find(categoryToFind => categoryToFind.name === "Other");
        }

        if (this.info().id && selectedIcon == null) {
            selectedIcon = { icon: this.info().icon, color: "black", label: this.resources.other } as IconColorLabel;
            selectedCategory.icons.push(selectedIcon);
        } else if (!this.info().id && selectedIcon == null) {
            selectedIcon = selectedCategory.icons[0];
        }
        this.selectCategory({ value: selectedCategory } as MatSelectChange);
        this.selectIcon(selectedIcon);
    }

    public selectCategory(e: MatSelectChange) {
        this.categories.forEach(c => c.isSelected = false);
        this.selectedCategory = e.value;
        this.selectedCategory.isSelected = true;
        if (this.selectedCategory.selectedIcon == null) {
            this.selectIcon(this.selectedCategory.icons[0]);
        }
    }

    public selectIcon(icon: IconColorLabel) {
        this.selectedCategory.selectedIcon = icon;
        this.info().icon = icon.icon;
    }

    public addEmptyUrl() {
        this.info().urls.push("");
    }

    public removeUrl(i: number) {
        this.info().urls.splice(i, 1);
    }

    public trackByIndex(index: number) {
        return index;
    }

    public isPoint(): boolean {
        return this.info != null && this.info().isPoint;
    }
}
