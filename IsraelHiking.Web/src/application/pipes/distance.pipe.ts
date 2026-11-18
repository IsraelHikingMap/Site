import { inject, Pipe, PipeTransform } from "@angular/core";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../services/resources.service";
import { ApplicationState } from "../models";

export type DistanceType = "distance" | "elevation";
/**
 * Which part of the formatted distance to return, so a template can style the unit apart from the number.
 */
export type DistancePart = "all" | "value" | "unit";

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

    transform(value: number, type: DistanceType = "distance", part: DistancePart = "all"): string {
        if (value == null) {
            return "0";
        }
        const isImperial = this.units() === "imperial";
        if (type === "elevation") {
            return isImperial
                ? this.format(value * 3.28084, "foot", 0, part)
                : this.format(value, "meter", 0, part);
        }
        if (isImperial) {
            const miles = value / 1609.34;
            if (Math.abs(miles) > 1) {
                return this.format(miles, "mile", 2, part);
            }
            return this.format(value * 3.28084, "foot", 0, part);
        }
        const kilometers = value / 1000.0;
        if (Math.abs(kilometers) > 1) {
            return this.format(kilometers, "kilometer", 2, part);
        }
        return this.format(value, "meter", 0, part);
    }

    private format(value: number, unit: string, maximumFractionDigits: number, part: DistancePart): string {
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
        if (part === "all") {
            return `\u200E${formatter.format(value)}`;
        }
        return formatter.formatToParts(value)
            .filter(p => (p.type === "unit") === (part === "unit"))
            .map(p => p.value)
            .join("")
            .trim();
    }
}
