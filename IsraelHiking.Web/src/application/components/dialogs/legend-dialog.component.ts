import { Component, inject } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader } from "@angular/material/expansion";
import { MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Store } from "@ngxs/store";
import { remove } from "lodash-es";

import { ILegendItem, LegendItemComponent } from "../legend-item.component";
import { ScrollToDirective } from "../../directives/scroll-to.directive";
import { ResourcesService } from "../../services/resources.service";
import { LayersService } from "../../services/layers.service";
import { HIKING_MAP, MTB_MAP } from "../../reducers/initial-state";
import type { ApplicationState } from "../../models";
import legendSectionsJson from "../../../content/legend/legend.json";

export type LegendSection = {
    key: keyof ResourcesService;
    items: ILegendItem[];
    title: string;
};

@Component({
    selector: "legend-dialog",
    templateUrl: "./legend-dialog.component.html",
    styleUrls: ["./legend-dialog.component.scss"],
    imports: [MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, LegendItemComponent, MatDialogTitle, MatDialogClose, MatDialogContent, MatButton]
})
export class LegendDialogComponent {
    public readonly resources = inject(ResourcesService);
    private readonly layersService = inject(LayersService);
    private readonly store = inject(Store);

    public legendSections: LegendSection[] = [];
    private selectedSection: LegendSection = null;

    constructor() {
        this.store.select((state: ApplicationState) => state.configuration.language).pipe(takeUntilDestroyed()).subscribe(() => {
            this.initalizeLegendSections();
        });
    }

    public openSection(section: LegendSection) {
        this.selectedSection = section;
    }

    public isSectionOpen(section: LegendSection) {
        return this.selectedSection != null && this.selectedSection.key === section.key;
    }

    public scrollTo(sectionKey: string) {
        ScrollToDirective.scrollTo(sectionKey);
    }

    private initalizeLegendSections() {
        this.legendSections = structuredClone(legendSectionsJson) as LegendSection[];
        for (const section of this.legendSections) {
            section.title = this.resources[section.key] as string;
            for (const item of section.items) {
                item.title = this.resources[item.key] as string;
            }
        }

        if (this.layersService.getSelectedBaseLayer().key === MTB_MAP) {
            this.removeMtbUnwantedLegend();
        } else if (this.layersService.getSelectedBaseLayer().key === HIKING_MAP) {
            this.removeIhmUnwantedLegend();
        } else {
            this.legendSections = [];
        }
    }

    private removeMtbUnwantedLegend() {
        remove(this.legendSections, sectionToRemove => sectionToRemove.title === this.resources.legendMarkedTrails);
        remove(this.legendSections, sectionToRemove => sectionToRemove.title === this.resources.legendRegionalTrails);

        this.removeItemInSection(this.resources.legendTrails, this.resources.legendDifficult4WD);
        this.removeItemInSection(this.resources.legendTrails, this.resources.legendBicyclePath);

        this.removeItemInSection(this.resources.legendRoads, this.resources.legendMotorway);
        this.removeItemInSection(this.resources.legendRoads, this.resources.legendTrunk);
        this.removeItemInSection(this.resources.legendRoads, this.resources.legendPrimary);
        this.removeItemInSection(this.resources.legendRoads, this.resources.legendSecondary);
        this.removeItemInSection(this.resources.legendRoads, this.resources.legendTertiary);
        this.removeItemInSection(this.resources.legendRoads, this.resources.legendUnclassified);
        this.removeItemInSection(this.resources.legendRoads, this.resources.legendResidential);

        this.removeItemInSection(this.resources.legendPoi, this.resources.legendPowerLine);

        this.removeItemInSection(this.resources.legendBorders, this.resources.legendMilitaryTraining);
        this.removeItemInSection(this.resources.legendBorders, this.resources.legendTheGreenLine);
        this.removeItemInSection(this.resources.legendBorders, this.resources.legendThePurpleLine);

        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendGuidepost);

        this.removeItemInSection(this.resources.legendAreas, this.resources.legendBeach);
    }

    private removeIhmUnwantedLegend() {
        remove(this.legendSections, sectionToRemove => sectionToRemove.title === this.resources.legendSingles);

        this.removeItemInSection(this.resources.legendWater, this.resources.legendRiver);

        this.removeItemInSection(this.resources.legendRoads, this.resources.legendPavedRoad);

        this.removeItemInSection(this.resources.legendPoi, this.resources.legendAttraction);
        this.removeItemInSection(this.resources.legendPoi, this.resources.legendFlowers);
        this.removeItemInSection(this.resources.legendPoi, this.resources.legendObservationTower);
        this.removeItemInSection(this.resources.legendPoi, this.resources.legendAntenna);

        this.removeItemInSection(this.resources.legendBorders, this.resources.legendBikePark);

        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendBikeShop);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendFirstAid);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendCafe);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendRestaurant);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendConvenienceStore);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendLodging);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendToilettes);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendInformationCenter);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendPlayground);

        this.removeItemInSection(this.resources.legendAreas, this.resources.legendVineyard);
        this.removeItemInSection(this.resources.legendAreas, this.resources.legendConstructionSite);
    }

    private removeItemInSection(sectionTitle: string, title: string) {
        const section = this.legendSections.find(sectionToFind => sectionToFind.title === sectionTitle);
        if (section) {
            remove(section.items, itemToRemove => itemToRemove.title === title);
        }
    }
}