import { Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { MatTabGroup, MatTab } from "@angular/material/tabs";
import { MatCard, MatCardContent } from "@angular/material/card";
import { NgIf, NgFor } from "@angular/common";
import { MatDivider } from "@angular/material/divider";
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader } from "@angular/material/expansion";
import { ScrollToModule } from "@nicky-lenaers/ngx-scroll-to";
import { remove } from "lodash-es";
import { Angulartics2GoogleGlobalSiteTag, Angulartics2OnModule } from "angulartics2";
import { Store } from "@ngxs/store";

import { Urls } from "../../urls";
import { ILegendItem, LegendItemComponent } from "./legend-item.component";
import { SidebarService } from "../../services/sidebar.service";
import { ResourcesService } from "../../services/resources.service";
import { LayersService } from "../../services/layers.service";
import { RunningContextService } from "../../services/running-context.service";
import { ISRAEL_MTB_MAP, ISRAEL_HIKING_MAP } from "../../reducers/initial-state";
import type { ApplicationState } from "../../models";
import legendSectionsJson from "../../../content/legend/legend.json";

export type LegendSection = {
    key: keyof ResourcesService;
    items: ILegendItem[];
    title: string;
};

@Component({
    selector: "info-sidebar",
    templateUrl: "./info-sidebar.component.html",
    styleUrls: ["./info-sidebar.component.scss"],
    imports: [Dir, MatButton, MatTabGroup, MatTab, MatCard, MatCardContent, NgIf, Angulartics2OnModule, MatDivider, MatAccordion, NgFor, MatExpansionPanel, MatExpansionPanelHeader, ScrollToModule, LegendItemComponent]
})
export class InfoSidebarComponent {
    public legendSections: LegendSection[] = [];
    public selectedTabIndex: number = 0;
    public androidAppUrl: string = Urls.ANDROID_APP_URL;
    public iosAppUrl: string = Urls.IOS_APP_URL;
    private selectedSection: LegendSection = null;

    public readonly resources = inject(ResourcesService);

    private readonly angulartics = inject(Angulartics2GoogleGlobalSiteTag);
    private readonly sidebarService = inject(SidebarService);
    private readonly layersService = inject(LayersService);
    private readonly runningContext = inject(RunningContextService);
    private readonly store = inject(Store);

    constructor() {
        this.store.select((state: ApplicationState) => state.configuration.language).pipe(takeUntilDestroyed()).subscribe(() => {
            this.initalizeLegendSections();
        });
    }

    public close() {
        this.sidebarService.hide();
    }

    public isActive(): boolean {
        return this.sidebarService.viewName === "info";
    }

    public selectedTabChanged(tabIndex: number) {
        if (tabIndex === 1) {
            this.initalizeLegendSections();
        }
        this.angulartics.eventTrack((tabIndex === 1 ? "Legend" : "About") + " tab selected", { category: "Info" });
    }

    public openSection(section: LegendSection) {
        this.selectedSection = section;
    }

    public isSectionOpen(section: LegendSection) {
        return this.selectedSection != null && this.selectedSection.key === section.key;
    }

    public isApp(): boolean {
        return this.runningContext.isCapacitor;
    }

    public isMobile(): boolean {
        return this.runningContext.isMobile;
    }

    private initalizeLegendSections() {
        this.legendSections = structuredClone(legendSectionsJson) as LegendSection[];
        for (const section of this.legendSections) {
            section.title = this.resources[section.key] as string;
            for (const item of section.items) {
                item.title = this.resources[item.key] as string;
            }
        }

        if (this.layersService.getSelectedBaseLayer().key === ISRAEL_MTB_MAP) {
            this.removeMtbUnwantedLegend();
        } else if (this.layersService.getSelectedBaseLayer().key === ISRAEL_HIKING_MAP) {
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
