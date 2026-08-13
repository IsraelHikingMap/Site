import { describe, beforeEach, afterEach, vi, it, expect } from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideStore, Store } from "@ngxs/store";

import { ThemeService } from "./theme.service";
import { ConfigurationReducer, SetThemeAction } from "../reducers/configuration.reducer";
import { GpsReducer, SetCurrentPositionAction } from "../reducers/gps.reducer";
import { InMemoryReducer } from "../reducers/in-memory.reducer";
import type { ApplicationState, ThemeSetting } from "../models";

describe("ThemeService", () => {
    const telAvivPosition = { coords: { latitude: 32.0853, longitude: 34.7818 } } as GeolocationPosition;
    /** Far enough north for a midnight sun in the summer and a polar night in the winter */
    const svalbardPosition = { coords: { latitude: 78.22, longitude: 15.65 } } as GeolocationPosition;
    /** Noon in Tel Aviv */
    const daytime = new Date("2024-06-21T09:50:00Z");
    /** Midnight in Tel Aviv */
    const nighttime = new Date("2024-06-21T21:00:00Z");

    const isDarkApplied = () => document.body.classList.contains(ThemeService.DARK_THEME_CLASS);

    const startService = (theme: ThemeSetting, position: GeolocationPosition | null) => {
        const store = TestBed.inject(Store);
        store.dispatch(new SetThemeAction(theme));
        store.dispatch(new SetCurrentPositionAction(position));
        TestBed.inject(ThemeService).initialize();
        return store;
    };

    beforeEach(() => {
        vi.useFakeTimers();
        TestBed.configureTestingModule({
            providers: [
                provideStore([ConfigurationReducer, InMemoryReducer, GpsReducer]),
                ThemeService
            ]
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.classList.remove(ThemeService.DARK_THEME_CLASS);
    });

    it("should apply the dark theme when it is explicitly configured", () => {
        const store = startService("dark", null);

        expect(isDarkApplied()).toBe(true);
        expect(store.selectSnapshot((state: ApplicationState) => state.inMemoryState.effectiveTheme)).toBe("dark");
    });

    it("should apply the light theme when it is explicitly configured", () => {
        const store = startService("light", null);

        expect(isDarkApplied()).toBe(false);
        expect(store.selectSnapshot((state: ApplicationState) => state.inMemoryState.effectiveTheme)).toBe("light");
    });

    it("should ignore the sun when a theme is explicitly configured", () => {
        vi.setSystemTime(nighttime);

        startService("light", telAvivPosition);

        expect(isDarkApplied()).toBe(false);
    });

    it("should apply the light theme during the day when set to automatic", () => {
        vi.setSystemTime(daytime);

        startService("auto", telAvivPosition);

        expect(isDarkApplied()).toBe(false);
    });

    it("should apply the dark theme during the night when set to automatic", () => {
        vi.setSystemTime(nighttime);

        const store = startService("auto", telAvivPosition);

        expect(isDarkApplied()).toBe(true);
        expect(store.selectSnapshot((state: ApplicationState) => state.inMemoryState.effectiveTheme)).toBe("dark");
    });

    it("should stay light during the midnight sun when set to automatic", () => {
        vi.setSystemTime(new Date("2024-06-21T00:00:00Z"));

        startService("auto", svalbardPosition);

        expect(isDarkApplied()).toBe(false);
    });

    it("should stay dark during the polar night when set to automatic", () => {
        vi.setSystemTime(new Date("2024-12-21T11:00:00Z"));

        startService("auto", svalbardPosition);

        expect(isDarkApplied()).toBe(true);
    });

    it("should switch to dark as the sun sets when set to automatic", () => {
        vi.setSystemTime(daytime);
        startService("auto", telAvivPosition);
        expect(isDarkApplied()).toBe(false);

        vi.setSystemTime(nighttime);
        vi.advanceTimersByTime(5 * 60 * 1000);

        expect(isDarkApplied()).toBe(true);
    });

    it("should re-evaluate the theme when a new position arrives", () => {
        vi.setSystemTime(daytime);
        const store = startService("auto", null);

        // The same moment is the middle of the night on the other side of the globe
        store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 32.0853, longitude: -145 } } as GeolocationPosition));

        expect(isDarkApplied()).toBe(true);
    });

    it("should keep the current theme when there is no position and it is set to automatic", () => {
        vi.setSystemTime(nighttime);
        const store = startService("auto", telAvivPosition);
        expect(isDarkApplied()).toBe(true);

        store.dispatch(new SetCurrentPositionAction(null));

        expect(isDarkApplied()).toBe(true);
    });

    it("should not change the theme when there has never been a position and it is set to automatic", () => {
        vi.setSystemTime(nighttime);

        const store = startService("auto", null);

        expect(isDarkApplied()).toBe(false);
        expect(store.selectSnapshot((state: ApplicationState) => state.inMemoryState.effectiveTheme)).toBe("light");
    });

    it("should stop following the sun once the theme is no longer automatic", () => {
        vi.setSystemTime(daytime);
        startService("auto", telAvivPosition);

        TestBed.inject(Store).dispatch(new SetThemeAction("light"));
        vi.setSystemTime(nighttime);
        vi.advanceTimersByTime(5 * 60 * 1000);

        expect(isDarkApplied()).toBe(false);
    });
});
