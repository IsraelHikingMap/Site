import { describe, beforeEach, vi, it, expect } from "vitest";
import { EventEmitter } from "@angular/core";
import { inject, TestBed } from "@angular/core/testing";
import { provideStore, Store } from "@ngxs/store";

import { LocationService } from "./location.service";
import { GeoLocationService } from "./geo-location.service";
import { DeviceOrientationService } from "./device-orientation.service";
import { MapService } from "./map.service";
import { LoggingService } from "./logging.service";
import { SelectedRouteService } from "./selected-route.service";
import { GpsReducer, SetCurrentPositionAction } from "../reducers/gps.reducer";
import { InMemoryReducer, SetPannedAction } from "../reducers/in-memory.reducer";
import type { ApplicationState } from "../models";

/** A degree of longitude at the equator, which is what lets the pace tests walk in meters. */
const METERS_IN_A_LONGITUDE_DEGREE = 111319.49;

/** How often the gps reports a position while walking. */
const POSITION_INTERVAL_IN_SECONDS = 30;

type Walk = {
    /** The pace to walk at, in meters per second, zero to stand still. */
    speed: number;
    /** How long to keep walking for, in seconds. */
    duration: number;
};

/**
 * Walks on along the equator from wherever the gps last was, moving the clock along and feeding a
 * position into the gps state every {@link POSITION_INTERVAL_IN_SECONDS} - which is how the service
 * under test receives them.
 */
function walk(store: Store, { speed, duration }: Walk) {
    for (let elapsed = POSITION_INTERVAL_IN_SECONDS; elapsed <= duration; elapsed += POSITION_INTERVAL_IN_SECONDS) {
        vi.advanceTimersByTime(POSITION_INTERVAL_IN_SECONDS * 1000);
        const meters = walkedMeters(store) + POSITION_INTERVAL_IN_SECONDS * speed;
        store.dispatch(new SetCurrentPositionAction({
            coords: { latitude: 0, longitude: meters / METERS_IN_A_LONGITUDE_DEGREE },
            timestamp: Date.now()
        } as unknown as GeolocationPosition));
    }
}

/** How far along the equator the gps last was, so that a walk carries on from where the last one ended. */
function walkedMeters(store: Store): number {
    const position = store.selectSnapshot((state: ApplicationState) => state.gpsState).currentPosition;
    return position == null ? 0 : position.coords.longitude * METERS_IN_A_LONGITUDE_DEGREE;
}

function resetStoreWithoutPosition(store: Store) {
    store.reset({
        gpsState: { currentPosition: null, tracking: "tracking" },
        inMemoryState: { following: false }
    });
}

describe("LocationService", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T08:00:00Z"));
        const geoLocationService = {
            backToForeground: new EventEmitter<number>(),
            bulkPositionChanged: {
                subscribe: () => { }
            },
            enable: vi.fn(),
            disable: vi.fn(),
            restoreTracking: vi.fn()
        };
        const deviceOrientationService = {
            orientationChanged: new EventEmitter<number>(),
            enable: vi.fn(),
            disable: vi.fn()
        };
        const mapService = {
            isMoving: () => false,
            initializationPromise: Promise.resolve(),
            moveToWithCurrentZoom: vi.fn()
        };
        TestBed.configureTestingModule({
            providers: [
                provideStore([InMemoryReducer, GpsReducer]),
                { provide: GeoLocationService, useValue: geoLocationService },
                {
                    provide: DeviceOrientationService,
                    useValue: deviceOrientationService
                },
                { provide: MapService, useValue: mapService },
                { provide: LoggingService, useValue: { warning: () => { } } },
                {
                    provide: SelectedRouteService,
                    useValue: {
                        getSelectedRoute: vi.fn().mockReturnValue({ state: "Poi" }),
                        isEditingRoute: () => false
                    }
                },
                LocationService
            ]
        });
    });

    it("Should initialize without any failures", inject([LocationService], async (service: LocationService) => {
        await expect(service.initialize()).resolves.not.toThrow();
        expect(service.getLocationCenter()).toBeUndefined();
    }));

    it("Should call disable of services when disabled", inject([LocationService, GeoLocationService, DeviceOrientationService],
        async (service: LocationService, geoLocationService: GeoLocationService, deviceOrientationService: DeviceOrientationService) => {
            await service.disable();

            expect(geoLocationService.disable).toHaveBeenCalled();
            expect(deviceOrientationService.disable).toHaveBeenCalled();
        }
    ));

    it("Should call enable of services when enabled", inject([LocationService, GeoLocationService, DeviceOrientationService],
        (service: LocationService, geoLocationService: GeoLocationService, deviceOrientationService: DeviceOrientationService) => {
            service.enable();
            expect(geoLocationService.enable).toHaveBeenCalled();
            expect(deviceOrientationService.enable).toHaveBeenCalled();
        }
    ));

    it("Should not move to gps position if position is not defined", inject([LocationService, MapService], (service: LocationService, mapService: MapService) => {
        service.moveMapToGpsPosition();

        expect(mapService.moveToWithCurrentZoom).not.toHaveBeenCalled();
    }));

    it("Should move to gps position if a new valid position is received", inject([LocationService, MapService, Store],
        async (service: LocationService, mapService: MapService, store: Store) => {
            store.reset({
                gpsState: { currentPosition: null },
                inMemoryState: { following: false }
            });
            await service.initialize();
            const eventSpy = vi.fn();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 1, longitude: 2 } } as unknown as GeolocationPosition));
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3 } } as unknown as GeolocationPosition));

            expect(eventSpy).toHaveBeenCalled();
            expect(mapService.moveToWithCurrentZoom).toHaveBeenCalled();
        }
    ));

    it("Should move to gps position with heading from gps", inject([LocationService, MapService, Store],
        async (service: LocationService, mapService: MapService, store: Store) => {
            store.reset({
                gpsState: { currentPosition: null },
                inMemoryState: { following: false }
            });
            await service.initialize();
            const eventSpy = vi.fn();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 1, longitude: 2 } } as unknown as GeolocationPosition));
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3, speed: 3, heading: 4 } } as unknown as GeolocationPosition));

            expect(eventSpy).toHaveBeenCalled();
            expect(mapService.moveToWithCurrentZoom).toHaveBeenCalledWith({ lat: 2, lng: 3, alt: undefined }, 4);
        }
    ));

    it("Should move to gps position with heading 0 when keep north up", inject([LocationService, MapService, Store],
        async (service: LocationService, mapService: MapService, store: Store) => {
            store.reset({
                gpsState: { currentPosition: null },
                inMemoryState: { following: false, keepNorthUp: true }
            });
            await service.initialize();
            const eventSpy = vi.fn();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 1, longitude: 2 } } as unknown as GeolocationPosition));
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3, speed: 3, heading: 4 } } as unknown as GeolocationPosition));

            expect(eventSpy).toHaveBeenCalled();
            expect(mapService.moveToWithCurrentZoom).toHaveBeenCalledWith({ lat: 2, lng: 3, alt: undefined }, 0);
        }
    ));

    it("Should not move to gps position when given invalid location", inject([LocationService, MapService, Store],
        async (service: LocationService, mapService: MapService, store: Store) => {
            store.reset({
                gpsState: { currentPosition: null },
                inMemoryState: { following: false }
            });
            await service.initialize();
            const eventSpy = vi.fn();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: NaN, longitude: NaN } } as unknown as GeolocationPosition));

            expect(eventSpy).not.toHaveBeenCalled();
            expect(mapService.moveToWithCurrentZoom).not.toHaveBeenCalled();
        }
    ));

    it("Should not do anything on orientation change and no location", inject([LocationService, DeviceOrientationService],
        async (service: LocationService, deviceOrientationService: DeviceOrientationService) => {
            await service.initialize();
            const eventSpy = vi.fn();
            service.changed.subscribe(eventSpy);
            deviceOrientationService.orientationChanged.emit(1);

            expect(eventSpy).not.toHaveBeenCalled();
        }
    ));

    it("Should not do anything on orientation change and not in active state", inject([LocationService, DeviceOrientationService, Store],
        async (service: LocationService, deviceOrientationService: DeviceOrientationService, store: Store) => {
            store.reset({
                gpsState: {
                    currentPosition: null,
                    tracking: "searching"
                },
                inMemoryState: { following: true }
            });
            await service.initialize();
            const eventSpy = vi.fn();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 1, longitude: 2 } } as unknown as GeolocationPosition));
            deviceOrientationService.orientationChanged.emit(1);

            expect(eventSpy).not.toHaveBeenCalledTimes(2);
        }
    ));

    it("Should not do anything on orientation change and last update time was recent", inject([LocationService, DeviceOrientationService, Store],
        async (service: LocationService, deviceOrientationService: DeviceOrientationService, store: Store) => {
            store.reset({
                gpsState: {
                    currentPosition: null,
                    tracking: "tracking"
                },
                inMemoryState: { following: true }
            });
            await service.initialize();
            const eventSpy = vi.fn();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 1, longitude: 2, speed: 3, heading: 4 } } as unknown as GeolocationPosition));
            deviceOrientationService.orientationChanged.emit(5);

            expect(eventSpy).not.toHaveBeenCalledTimes(2);
        }
    ));

    it("Should fire orientation change when in active state", inject([LocationService, DeviceOrientationService, Store],
        async (service: LocationService, deviceOrientationService: DeviceOrientationService, store: Store) => {
            store.reset({
                gpsState: {
                    currentPosition: null,
                    tracking: "tracking"
                },
                inMemoryState: { following: true }
            });
            await service.initialize();
            const eventSpy = vi.fn();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3 } } as unknown as GeolocationPosition));
            deviceOrientationService.orientationChanged.emit(5);

            expect(eventSpy).toHaveBeenCalledTimes(2);
        }
    ));

    it("Should move to gps position after returning from background", inject([LocationService, GeoLocationService, MapService, Store],
        async (service: LocationService, geolocationService: GeoLocationService, mapService: MapService, store: Store) => {
            store.reset({
                gpsState: {
                    currentPosition: null,
                    tracking: "tracking"
                },
                inMemoryState: { following: true }
            });
            await service.initialize();
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3 } } as unknown as GeolocationPosition));
            geolocationService.backToForeground.emit();

            expect(mapService.moveToWithCurrentZoom).toHaveBeenCalled();
            expect(service.getLocationCenter()).toEqual({ lat: 2, lng: 3, alt: undefined });
        }
    ));

    it("Should disable distance when centering", inject([LocationService, Store],
        async (service: LocationService, store: Store) => {
            store.reset({
                gpsState: {
                    currentPosition: null,
                    tracking: "tracking"
                },
                inMemoryState: { following: true, distance: true }
            });
            await service.initialize();

            expect(store.selectSnapshot((s: ApplicationState) => s.inMemoryState).distance).toBeFalsy();
        }
    ));

    it("Should not be following when panned", inject([LocationService, Store],
        async (service: LocationService, store: Store) => {
            store.reset({
                gpsState: {
                    currentPosition: null,
                    tracking: "tracking"
                },
                inMemoryState: { following: true, distance: true }
            });
            await service.initialize();
            expect(service.isFollowing()).toBeTruthy();
            store.dispatch(new SetPannedAction(new Date()));
            expect(service.isFollowing()).toBeFalsy();
        }
    ));

    it("Should not move to gps position when editing route", inject([LocationService, Store, SelectedRouteService, MapService, DeviceOrientationService],
        async (service: LocationService, store: Store, selectedRouteService: SelectedRouteService, mapService: MapService, deviceOrientationService: DeviceOrientationService) => {
            store.reset({
                gpsState: {
                    currentPosition: null,
                    tracking: "tracking"
                },
                inMemoryState: { following: true, distance: true }
            });
            // isFollowing is a computed; set the mock before initialize() so its first (memoized) evaluation sees it.
            (selectedRouteService as { isEditingRoute: () => boolean }).isEditingRoute = () => true;
            await service.initialize();
            mapService.moveToWithCurrentZoom = vi.fn();

            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3, speed: 4 } } as unknown as GeolocationPosition));
            deviceOrientationService.orientationChanged.emit(1);

            expect(mapService.moveToWithCurrentZoom).not.toHaveBeenCalled();
        }
    ));

    it("Should not give a remaining time before a pace was measured", inject([LocationService, Store],
        async (service: LocationService, store: Store) => {
            resetStoreWithoutPosition(store);
            await service.initialize();
            store.dispatch(new SetCurrentPositionAction({
                coords: { latitude: 0, longitude: 0 },
                timestamp: Date.now()
            } as unknown as GeolocationPosition));

            expect(service.getRemainingTimeInSeconds(1000)).toBeNull();
            expect(service.getRemainingTimeInSeconds(0)).toBeNull();
        }
    ));

    it("Should use the speed the gps reported until the trail is long enough to measure a pace", inject([LocationService, Store],
        async (service: LocationService, store: Store) => {
            resetStoreWithoutPosition(store);
            await service.initialize();
            store.dispatch(new SetCurrentPositionAction({
                coords: { latitude: 0, longitude: 0, speed: 2 },
                timestamp: Date.now()
            } as unknown as GeolocationPosition));

            expect(service.getRemainingTimeInSeconds(1000)).toBeCloseTo(500, -2);

            walk(store, { speed: 1, duration: 300 });

            expect(service.getRemainingTimeInSeconds(1000)).toBeCloseTo(1000, -2);
        }
    ));

    it("Should follow the recent pace and forget the pace of an hour ago", inject([LocationService, Store],
        async (service: LocationService, store: Store) => {
            resetStoreWithoutPosition(store);
            await service.initialize();
            // ten minutes of driving to the trailhead
            walk(store, { speed: 10, duration: 600 });
            const whileDriving = service.getRemainingTimeInSeconds(1000);
            // then twenty minutes of walking, which is longer than the pace window
            walk(store, { speed: 1, duration: 1200 });

            expect(whileDriving).toBeCloseTo(100, -2);
            expect(service.getRemainingTimeInSeconds(1000)).toBeCloseTo(1000, -2);
        }
    ));

    it("Should hold the arrival time rather than lose it when the walk stops for a long rest", inject([LocationService, Store],
        async (service: LocationService, store: Store) => {
            resetStoreWithoutPosition(store);
            await service.initialize();
            walk(store, { speed: 1, duration: 300 });
            const whileWalking = service.getRemainingTimeInSeconds(1000);
            // half an hour of standing still, which is longer than the pace window
            walk(store, { speed: 0, duration: 1800 });
            const afterRest = service.getRemainingTimeInSeconds(1000);
            walk(store, { speed: 0, duration: 600 });

            // the arrival time moves back while resting, and stops moving once the rest is all there is to measure
            expect(afterRest).toBeGreaterThan(whileWalking);
            expect(service.getRemainingTimeInSeconds(1000)).toBe(afterRest);
        }
    ));

    it("Should start a new trail after the positions stopped arriving for a while", inject([LocationService, Store],
        async (service: LocationService, store: Store) => {
            resetStoreWithoutPosition(store);
            await service.initialize();
            walk(store, { speed: 1, duration: 300 });
            vi.advanceTimersByTime(60 * 60 * 1000);
            // an hour later and a hundred kilometers away, so only the speed it reports is left to go by
            store.dispatch(new SetCurrentPositionAction({
                coords: { latitude: 0, longitude: 0.9, speed: 2 },
                timestamp: Date.now()
            } as unknown as GeolocationPosition));

            expect(service.getRemainingTimeInSeconds(1000)).toBeCloseTo(500, -2);
        }
    ));

    it("Should forget the measured pace when disabled", inject([LocationService, Store],
        async (service: LocationService, store: Store) => {
            resetStoreWithoutPosition(store);
            await service.initialize();
            walk(store, { speed: 1, duration: 300 });
            await service.disable();

            expect(service.getRemainingTimeInSeconds(1000)).toBeNull();
        }
    ));
});
