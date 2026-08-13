import { describe, beforeEach, afterEach, vi, it, expect } from "vitest";
import { inject, TestBed } from "@angular/core/testing";
import { provideStore, Store } from "@ngxs/store";

import { ThemeService } from "./theme.service";
import { ConfigurationReducer, SetThemeAction } from "../reducers/configuration.reducer";
import { GpsReducer, SetCurrentPositionAction } from "../reducers/gps.reducer";
import { InMemoryReducer } from "../reducers/in-memory.reducer";
import type { ApplicationState } from "../models";

describe("ThemeService", () => {
    const telAvivPosition = { coords: { latitude: 32.0853, longitude: 34.7818 } } as GeolocationPosition;
    /** Far enough north for a midnight sun in the summer and a polar night in the winter */
    const svalbardPosition = { coords: { latitude: 78.22, longitude: 15.65 } } as GeolocationPosition;
    const noonTelAvivTime = new Date("2024-06-21T09:50:00Z");
    const midNightTelAvivTime = new Date("2024-06-21T21:00:00Z");

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

    it("should apply the dark theme when it is explicitly configured", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            store.dispatch(new SetThemeAction("dark"));

            service.initialize();

            expect(document.body.classList).toContain(ThemeService.DARK_THEME_CLASS);
            expect(store.selectSnapshot((state: ApplicationState) => state.inMemoryState.effectiveTheme)).toBe("dark");
        })
    );

    it("should apply the light theme when it is explicitly configured", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            store.dispatch(new SetThemeAction("light"));

            service.initialize();

            expect(document.body.classList).not.toContain(ThemeService.DARK_THEME_CLASS);
            expect(store.selectSnapshot((state: ApplicationState) => state.inMemoryState.effectiveTheme)).toBe("light");
        })
    );

    it("should ignore the sun when a theme is explicitly configured", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            vi.setSystemTime(midNightTelAvivTime);
            store.dispatch(new SetThemeAction("light"));
            store.dispatch(new SetCurrentPositionAction(telAvivPosition));

            service.initialize();

            expect(document.body.classList).not.toContain(ThemeService.DARK_THEME_CLASS);
        })
    );

    it("should apply the light theme during the day when set to automatic", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            vi.setSystemTime(noonTelAvivTime);
            store.dispatch(new SetThemeAction("auto"));
            store.dispatch(new SetCurrentPositionAction(telAvivPosition));

            service.initialize();

            expect(document.body.classList).not.toContain(ThemeService.DARK_THEME_CLASS);
        })
    );

    it("should apply the dark theme during the night when set to automatic", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            vi.setSystemTime(midNightTelAvivTime);
            store.dispatch(new SetThemeAction("auto"));
            store.dispatch(new SetCurrentPositionAction(telAvivPosition));

            service.initialize();

            expect(document.body.classList).toContain(ThemeService.DARK_THEME_CLASS);
            expect(store.selectSnapshot((state: ApplicationState) => state.inMemoryState.effectiveTheme)).toBe("dark");
        })
    );

    it("should stay light during the midnight sun when set to automatic", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            vi.setSystemTime(new Date("2024-06-21T00:00:00Z"));
            store.dispatch(new SetThemeAction("auto"));
            store.dispatch(new SetCurrentPositionAction(svalbardPosition));

            service.initialize();

            expect(document.body.classList).not.toContain(ThemeService.DARK_THEME_CLASS);
        })
    );

    it("should stay dark during the polar night when set to automatic", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            vi.setSystemTime(new Date("2024-12-21T11:00:00Z"));
            store.dispatch(new SetThemeAction("auto"));
            store.dispatch(new SetCurrentPositionAction(svalbardPosition));

            service.initialize();

            expect(document.body.classList).toContain(ThemeService.DARK_THEME_CLASS);
        })
    );

    it("should switch to dark as the sun sets when set to automatic", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            vi.setSystemTime(noonTelAvivTime);
            store.dispatch(new SetThemeAction("auto"));
            store.dispatch(new SetCurrentPositionAction(telAvivPosition));
            service.initialize();
            expect(document.body.classList).not.toContain(ThemeService.DARK_THEME_CLASS);

            vi.setSystemTime(midNightTelAvivTime);
            vi.advanceTimersByTime(10 * 60 * 1000);

            expect(document.body.classList).toContain(ThemeService.DARK_THEME_CLASS);
        })
    );

    it("should re-evaluate the theme when a new position arrives", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            vi.setSystemTime(noonTelAvivTime);
            store.dispatch(new SetThemeAction("auto"));
            service.initialize();

            // The same moment is the middle of the night on the other side of the globe
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 32.0853, longitude: -145 } } as GeolocationPosition));

            expect(document.body.classList).toContain(ThemeService.DARK_THEME_CLASS);
        })
    );

    it("should keep the current theme when there is no position and it is set to automatic", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            vi.setSystemTime(midNightTelAvivTime);
            store.dispatch(new SetThemeAction("auto"));
            store.dispatch(new SetCurrentPositionAction(telAvivPosition));
            service.initialize();
            expect(document.body.classList).toContain(ThemeService.DARK_THEME_CLASS);

            store.dispatch(new SetCurrentPositionAction(null));

            expect(document.body.classList).toContain(ThemeService.DARK_THEME_CLASS);
        })
    );

    it("should not change the theme when there has never been a position and it is set to automatic", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            vi.setSystemTime(midNightTelAvivTime);
            store.dispatch(new SetThemeAction("auto"));

            service.initialize();

            expect(document.body.classList).not.toContain(ThemeService.DARK_THEME_CLASS);
            expect(store.selectSnapshot((state: ApplicationState) => state.inMemoryState.effectiveTheme)).toBe("light");
        })
    );

    it("should stop following the sun once the theme is no longer automatic", inject([ThemeService, Store],
        (service: ThemeService, store: Store) => {
            vi.setSystemTime(noonTelAvivTime);
            store.dispatch(new SetThemeAction("auto"));
            store.dispatch(new SetCurrentPositionAction(telAvivPosition));
            service.initialize();

            store.dispatch(new SetThemeAction("light"));
            vi.setSystemTime(midNightTelAvivTime);
            vi.advanceTimersByTime(5 * 60 * 1000);

            expect(document.body.classList).not.toContain(ThemeService.DARK_THEME_CLASS);
        })
    );
});
