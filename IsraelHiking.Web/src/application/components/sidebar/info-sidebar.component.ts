import { Component } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { remove } from "lodash-es";
import { Angulartics2GoogleGlobalSiteTag } from "angulartics2";
import { Observable } from "rxjs";
import { Select } from "@angular-redux2/store";

import { BaseMapComponent } from "../base-map.component";
import { DownloadDialogComponent } from "../dialogs/download-dialog.component";
import { ILegendItem } from "./legend-item.component";
import { SidebarService } from "../../services/sidebar.service";
import { ResourcesService } from "../../services/resources.service";
import { LayersService } from "../../services/layers.service";
import { RunningContextService } from "../../services/running-context.service";
import { ISRAEL_MTB_MAP, ISRAEL_HIKING_MAP } from "../../reducers/initial-state";
import type { ApplicationState, Language } from "../../models/models";
import legendSectionsJson from "../../../content/legend/legend.json";

export type LegendSection = {
    key: keyof ResourcesService;
    items: ILegendItem[];
    title: string;
};

@Component({
    selector: "info-sidebar",
    templateUrl: "./info-sidebar.component.html",
    styleUrls: ["./info-sidebar.component.scss"]
})
export class InfoSidebarComponent extends BaseMapComponent {
    public legendSections: LegendSection[];
    public selectedTabIndex: number;
    private selectedSection: LegendSection;

    @Select((state: ApplicationState) => state.configuration.language)
    private language$: Observable<Language>;

    constructor(resources: ResourcesService,
                private readonly dialog: MatDialog,
                private readonly angulartics: Angulartics2GoogleGlobalSiteTag,
                private readonly sidebarService: SidebarService,
                private readonly layersService: LayersService,
                private readonly runningContext: RunningContextService) {
        super(resources);

        this.selectedTabIndex = 0;
        this.selectedSection = null;
        this.legendSections = [];

        this.language$.subscribe(() => {
            this.initalizeLegendSections();
        });
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

    public openDownloadDialog(event: Event) {
        event.preventDefault();
        this.dialog.open(DownloadDialogComponent);
    }

    private initalizeLegendSections() {
        this.legendSections = JSON.parse(JSON.stringify(legendSectionsJson));
        for (let section of this.legendSections) {
            section.title = this.resources[section.key] as string;
            for (let item of section.items) {
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
        this.removeItemInSection(this.resources.legendWater, this.resources.legendWaterfall);

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
        this.removeItemInSection(this.resources.legendAreas, this.resources.legendCemetery);
        this.removeItemInSection(this.resources.legendAreas, this.resources.legendConstructionSite);
    }

    private removeItemInSection(sectionTitle: string, title: string) {
        let section = this.legendSections.find(sectionToFind => sectionToFind.title === sectionTitle);
        if (section) {
            remove(section.items, itemToRemove => itemToRemove.title === title);
        }
    }
}
