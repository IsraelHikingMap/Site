import { Component, inject, signal } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader } from "@angular/material/expansion";
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Store } from "@ngxs/store";
import { remove } from "lodash-es";

import { ILegendItem, LegendItemComponent } from "../legend-item.component";
import { ScrollToDirective } from "../../directives/scroll-to.directive";
import { ResourcesService } from "../../services/resources.service";
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
    imports: [MatIconButton, MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, LegendItemComponent, MatDialogTitle, MatDialogClose, MatDialogContent]
})
export class LegendDialogComponent {
    public readonly resources = inject(ResourcesService);
    private readonly store = inject(Store);
    private readonly data = inject<string>(MAT_DIALOG_DATA);

    public readonly legendSections = signal<LegendSection[]>([]);
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
        let sections = structuredClone(legendSectionsJson) as LegendSection[];
        for (const section of sections) {
            section.title = this.resources[section.key] as string;
            for (const item of section.items) {
                item.title = this.resources[item.key] as string;
            }
        }

        if (this.data === MTB_MAP) {
            this.removeMtbUnwantedLegend(sections);
        } else if (this.data === HIKING_MAP) {
            this.removeIhmUnwantedLegend(sections);
        } else {
            sections = [];
        }
        this.legendSections.set(sections);
    }

    private removeMtbUnwantedLegend(sections: LegendSection[]) {
        remove(sections, sectionToRemove => sectionToRemove.title === this.resources.legendMarkedTrails);
        remove(sections, sectionToRemove => sectionToRemove.title === this.resources.legendRegionalTrails);

        this.removeItemInSection(sections, this.resources.legendTracksAndPaths, this.resources.legendChallenging4WDTrack);
        this.removeItemInSection(sections, this.resources.legendTracksAndPaths, this.resources.legendBicyclePath);

        this.removeItemInSection(sections, this.resources.legendRoads, this.resources.legendMotorway);
        this.removeItemInSection(sections, this.resources.legendRoads, this.resources.legendTrunk);
        this.removeItemInSection(sections, this.resources.legendRoads, this.resources.legendPrimary);
        this.removeItemInSection(sections, this.resources.legendRoads, this.resources.legendSecondary);
        this.removeItemInSection(sections, this.resources.legendRoads, this.resources.legendTertiary);
        this.removeItemInSection(sections, this.resources.legendRoads, this.resources.legendUnclassified);
        this.removeItemInSection(sections, this.resources.legendRoads, this.resources.legendResidential);

        this.removeItemInSection(sections, this.resources.legendPoi, this.resources.legendPowerLine);

        this.removeItemInSection(sections, this.resources.legendBorders, this.resources.legendMilitaryTraining);
        this.removeItemInSection(sections, this.resources.legendBorders, this.resources.legendTheGreenLine);
        this.removeItemInSection(sections, this.resources.legendBorders, this.resources.legendThePurpleLine);

        this.removeItemInSection(sections, this.resources.legendAmenities, this.resources.legendGuidepost);

        this.removeItemInSection(sections, this.resources.legendAreas, this.resources.legendBeach);
    }

    private removeIhmUnwantedLegend(sections: LegendSection[]) {
        remove(sections, sectionToRemove => sectionToRemove.title === this.resources.legendCyclingDifficulty);

        this.removeItemInSection(sections, this.resources.legendWater, this.resources.legendRiver);

        this.removeItemInSection(sections, this.resources.legendRoads, this.resources.legendPavedRoad);

        this.removeItemInSection(sections, this.resources.legendPoi, this.resources.legendAttraction);
        this.removeItemInSection(sections, this.resources.legendPoi, this.resources.legendFlowers);
        this.removeItemInSection(sections, this.resources.legendPoi, this.resources.legendObservationTower);
        this.removeItemInSection(sections, this.resources.legendPoi, this.resources.legendAntenna);

        this.removeItemInSection(sections, this.resources.legendBorders, this.resources.legendBikePark);

        this.removeItemInSection(sections, this.resources.legendAmenities, this.resources.legendBikeShop);
        this.removeItemInSection(sections, this.resources.legendAmenities, this.resources.legendFirstAid);
        this.removeItemInSection(sections, this.resources.legendAmenities, this.resources.legendCafe);
        this.removeItemInSection(sections, this.resources.legendAmenities, this.resources.legendRestaurant);
        this.removeItemInSection(sections, this.resources.legendAmenities, this.resources.legendConvenienceStore);
        this.removeItemInSection(sections, this.resources.legendAmenities, this.resources.legendLodging);
        this.removeItemInSection(sections, this.resources.legendAmenities, this.resources.legendToilets);
        this.removeItemInSection(sections, this.resources.legendAmenities, this.resources.legendTravelInformation);
        this.removeItemInSection(sections, this.resources.legendAmenities, this.resources.legendPlayground);

        this.removeItemInSection(sections, this.resources.legendAreas, this.resources.legendVineyard);
        this.removeItemInSection(sections, this.resources.legendAreas, this.resources.legendConstructionSite);
    }

    private removeItemInSection(sections: LegendSection[], sectionTitle: string, title: string) {
        const section = sections.find(sectionToFind => sectionToFind.title === sectionTitle);
        if (section) {
            remove(section.items, itemToRemove => itemToRemove.title === title);
        }
    }
}