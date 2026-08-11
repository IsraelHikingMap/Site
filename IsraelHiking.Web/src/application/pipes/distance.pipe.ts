import { inject, Pipe, PipeTransform } from "@angular/core";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../services/resources.service";
import { ApplicationState } from "../models";

export type DistanceType = "distance" | "elevation";

@Pipe({
    name: "distance",
    standalone: true,
    pure: false
})
export class DistancePipe implements PipeTransform {
    private static readonly formatters = new Map<string, Intl.NumberFormat>();

    private readonly resources = inject(ResourcesService);
    private readonly store = inject(Store);

    private readonly units = this.store.selectSignal((state: ApplicationState) => state.configuration.units);

    transform(value: number, type: DistanceType = "distance"): string {
        if (value == null) {
            return "0";
        }
        const isImperial = this.units() === "imperial";
        if (type === "elevation") {
            return isImperial
                ? this.format(value * 3.28084, "foot", 0)
                : this.format(value, "meter", 0);
        }
        if (isImperial) {
            const miles = value / 1609.34;
            if (Math.abs(miles) > 1) {
                return this.format(miles, "mile", 2);
            }
            return this.format(value * 3.28084, "foot", 0);
        }
        const kilometers = value / 1000.0;
        if (Math.abs(kilometers) > 1) {
            return this.format(kilometers, "kilometer", 2);
        }
        return this.format(value, "meter", 0);
    }

    private format(value: number, unit: string, maximumFractionDigits: number): string {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const key = `${language}_${unit}_${maximumFractionDigits}`;
        let formatter = DistancePipe.formatters.get(key);
        if (formatter == null) {
            formatter = new Intl.NumberFormat(language, {
                style: "unit",
                unit,
                maximumFractionDigits
            });
            DistancePipe.formatters.set(key, formatter);
        }
        return `\u200E${formatter.format(value)}`;
    }
}
