import { DOCUMENT, inject, Service } from "@angular/core";
import { Store } from "@ngxs/store";
import { getTimes } from "suncalc";

import { SetEffectiveThemeAction } from "../reducers/in-memory.reducer";
import type { ApplicationState, Theme, ThemeSetting } from "../models";

@Service()
export class ThemeService {
    public static readonly DARK_THEME_CLASS = "dark-theme";
    private static readonly AUTOMATIC_THEME_INTERVAL = 5 * 60 * 1000;
    private static readonly FALLBACK_SUNRISE_HOUR = 6;
    private static readonly FALLBACK_SUNSET_HOUR = 18;

    private automaticThemeInterval: ReturnType<typeof setInterval> | null = null;

    private readonly document = inject(DOCUMENT);
    private readonly store = inject(Store);

    public initialize() {
        this.store.select((state: ApplicationState) => state.configuration.theme).subscribe((theme: ThemeSetting) => {
            this.updateAutomaticThemeInterval(theme);
            this.updateTheme();
        });
        // A new position can mean the sun has set where the user now is, i.e. after crossing a time zone.
        this.store.select((state: ApplicationState) => state.gpsState.currentPosition).subscribe(() => this.updateTheme());
    }

    /** The automatic theme changes as time passes, so it needs to be re-evaluated even when nothing else happens */
    private updateAutomaticThemeInterval(theme: ThemeSetting) {
        if (theme === "auto" && this.automaticThemeInterval == null) {
            this.automaticThemeInterval = setInterval(() => this.updateTheme(), ThemeService.AUTOMATIC_THEME_INTERVAL);
        } else if (theme !== "auto" && this.automaticThemeInterval != null) {
            clearInterval(this.automaticThemeInterval);
            this.automaticThemeInterval = null;
        }
    }

    private updateTheme() {
        const currentTheme = this.store.selectSnapshot((state: ApplicationState) => state.inMemoryState.effectiveTheme);
        const theme = this.resolveTheme();
        if (currentTheme !== theme) {
            this.store.dispatch(new SetEffectiveThemeAction(theme));
        }
        this.applyTheme(theme);
    }

    /**
     * The automatic theme follows sunrise and sunset at the current GPS position, which is calculated locally
     * so it also works offline. The map's center is deliberately not used as a fallback since it can easily be
     * in another country while planning a trip - when there's no position the local clock is used instead,
     * assuming the sun rises at 6am and sets at 6pm.
     */
    private resolveTheme(): Theme {
        const theme = this.store.selectSnapshot((state: ApplicationState) => state.configuration.theme);
        if (theme !== "auto") {
            return theme;
        }
        const now = new Date();
        const position = this.store.selectSnapshot((state: ApplicationState) => state.gpsState.currentPosition);
        if (position == null) {
            return now.getHours() >= ThemeService.FALLBACK_SUNRISE_HOUR && now.getHours() < ThemeService.FALLBACK_SUNSET_HOUR
                ? "light"
                : "dark";
        }
        const times = getTimes(now, position.coords.latitude, position.coords.longitude);
        if (times.alwaysUp || times.alwaysDown) {
            // Polar day or night, where there is no sunrise or sunset to go by
            return times.alwaysUp ? "light" : "dark";
        }
        return now >= times.sunrise && now < times.sunset ? "light" : "dark";
    }

    private applyTheme(theme: Theme) {
        const body = this.document.body;
        if (body == null) {
            return;
        }
        if (theme === "dark") {
            body.classList.add(ThemeService.DARK_THEME_CLASS);
        } else {
            body.classList.remove(ThemeService.DARK_THEME_CLASS);
        }
    }
}
