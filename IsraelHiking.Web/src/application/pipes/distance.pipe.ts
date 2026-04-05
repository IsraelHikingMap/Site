import { inject, Pipe, PipeTransform } from "@angular/core";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../services/resources.service";
import { ApplicationState } from "../models";

@Pipe({
    name: "distance",
    standalone: true
})
export class DistancePipe implements PipeTransform {
    private readonly resources = inject(ResourcesService);
    private readonly store = inject(Store);

    transform(value: number): string {
        if (value == null) {
            return "0";
        }
        const units = this.store.selectSnapshot((state: ApplicationState) => state.configuration.units);
        const language = this.resources.getCurrentLanguageCodeSimplified();
        if (units === "imperial") {
            // convert from meters to miles
            const miles = value / 1609.34;
            if (Math.abs(miles) > 1) {
                const intlMileFromatter = new Intl.NumberFormat(language, {
                    style: "unit",
                    unit: "mile",
                    maximumFractionDigits: 2
                });
                return `\u200E${intlMileFromatter.format(miles)}`;
            }
            // convert from meters to feet
            const feet = value * 3.28084;
            const intlFeetFromatter = new Intl.NumberFormat(language, {
                style: "unit",
                unit: "foot",
                maximumFractionDigits: 0
            });
            return `\u200E${intlFeetFromatter.format(feet)}`;
        } else {
            const kilometers = value / 1000.0;
            if (Math.abs(kilometers) > 1) {
                const intlKmFromatter = new Intl.NumberFormat(language, {
                    style: "unit",
                    unit: "kilometer",
                    maximumFractionDigits: 2
                });
                return `\u200E${intlKmFromatter.format(kilometers)}`;
            }
            const intlMeterFromatter = new Intl.NumberFormat(language, {
                style: "unit",
                unit: "meter",
                maximumFractionDigits: 0
            });
            return `\u200E${intlMeterFromatter.format(value)}`;



        }
    }
}