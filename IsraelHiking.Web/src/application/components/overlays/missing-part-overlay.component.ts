import { Component, ViewEncapsulation, inject, input, output } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { NgClass } from "@angular/common";
import { MatTooltip } from "@angular/material/tooltip";
import { firstValueFrom } from "rxjs";

import { CoordinatesComponent } from "../coordinates.component";
import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { Urls } from "../../urls";
import type { LatLngAlt } from "../../models";

@Component({
    selector: "missing-part-overlay",
    templateUrl: "./missing-part-overlay.component.html",
    styleUrls: ["./missing-part-overlay.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [Dir, MatButton, NgClass, MatTooltip, Angulartics2OnModule, CoordinatesComponent]
})
export class MissingPartOverlayComponent {

    public latlng = input<LatLngAlt>();

    public feature = input<GeoJSON.Feature<GeoJSON.LineString>>();

    public removed = output();

    public hideCoordinates: boolean = true;

    public readonly resources = inject(ResourcesService);

    private readonly httpClient = inject(HttpClient);
    private readonly toastService = inject(ToastService);

    public getHighwayType(): string {
        return this.feature().properties.highway || "track";
    }

    public setHighwayType(highwayType: string) {
        this.feature().properties.highway = highwayType;
    }

    public getColor(): string {
        return this.feature().properties.colour || "none";
    }

    public setColor(color: string) {
        this.feature().properties.colour = color;
        if (color === "none") {
            delete this.feature().properties.colour;
        }
    }

    public async addMissingPartToOsm() {
        try {
            await firstValueFrom(this.httpClient.put(Urls.missingParts, this.feature()));
            this.toastService.success(this.resources.routeAddedSuccessfullyItWillTakeTime);
            this.remove();
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToSendRoute);
        }
    }

    public remove() {
        this.removed.emit();
    }
}
