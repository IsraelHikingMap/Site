import { EventEmitter } from "@angular/core";
import { inject, TestBed } from "@angular/core/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { LocationService } from "./location.service";
import { GeoLocationService } from "./geo-location.service";
import { DeviceOrientationService } from "./device-orientation.service";
import { MapService } from "./map.service";
import { LoggingService } from "./logging.service";
import { SelectedRouteService } from "./selected-route.service";
import { GpsReducer, SetCurrentPositionAction } from "../reducers/gps.reducer";
import { InMemoryReducer, SetPannedAction } from "../reducers/in-memory.reducer";

describe("LocationService", () => {

    beforeEach(() => {
        const geoLocationService = {
            backToForeground: new EventEmitter<number>(),
            bulkPositionChanged: {
                subscribe: () => { }
            },
            enable: jasmine.createSpy("enable"),
            disable: jasmine.createSpy("disable")
        };
        const deviceOrientationService = {
            orientationChanged: new EventEmitter<number>(),
            enable: jasmine.createSpy("enable"),
            disable: jasmine.createSpy("disable")
        };
        const mapService = {
            isMoving: () => false,
            initializationPromise: Promise.resolve(),
            moveToWithCurrentZoom: jasmine.createSpy("moveToWithCurrentZoom")
        };
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([InMemoryReducer, GpsReducer])],
            providers: [
                { provide: GeoLocationService, useValue: geoLocationService },
                { provide: DeviceOrientationService, useValue: deviceOrientationService },
                { provide: MapService, useValue: mapService },
                { provide: LoggingService, useValue: { warning: () => { } } },
                {
                    provide: SelectedRouteService, useValue: {
                        getSelectedRoute: jasmine.createSpy().and.returnValue({ state: "Poi" }),
                        isEditingRoute: () => false
                    },
                },
                LocationService
            ]
        });
    });

    it("Should initialize without any failures", inject([LocationService], async (service: LocationService) => {
        await expectAsync(service.initialize()).toBeResolved();
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
            const eventSpy = jasmine.createSpy();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 1, longitude: 2 } } as any));
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3 } } as any));

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
            const eventSpy = jasmine.createSpy();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 1, longitude: 2 } } as any));
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3, speed: 3, heading: 4 } } as any));

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
            const eventSpy = jasmine.createSpy();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 1, longitude: 2 } } as any));
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3, speed: 3, heading: 4 } } as any));

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
            const eventSpy = jasmine.createSpy();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: NaN, longitude: NaN } } as any));

            expect(eventSpy).not.toHaveBeenCalled();
            expect(mapService.moveToWithCurrentZoom).not.toHaveBeenCalled();
        }
    ));

    it("Should not do anything on orientation change and no location", inject([LocationService, DeviceOrientationService],
        async (service: LocationService, deviceOrientationService: DeviceOrientationService) => {
            await service.initialize();
            const eventSpy = jasmine.createSpy();
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
            const eventSpy = jasmine.createSpy();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 1, longitude: 2 } } as any));
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
            const eventSpy = jasmine.createSpy();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 1, longitude: 2, speed: 3, heading: 4 } } as any));
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
            const eventSpy = jasmine.createSpy();
            service.changed.subscribe(eventSpy);
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3 } } as any));
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
            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3 } } as any));
            geolocationService.backToForeground.emit();

            expect(mapService.moveToWithCurrentZoom).toHaveBeenCalled();
            expect(service.getLocationCenter()).toEqual({ lat: 2, lng: 3, alt: undefined });
        }));

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

            expect(store.selectSnapshot((s: any) => s.inMemoryState).distance).toBeFalsy();
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
            await service.initialize();
            selectedRouteService.isEditingRoute = () => true;
            mapService.moveToWithCurrentZoom = jasmine.createSpy();

            store.dispatch(new SetCurrentPositionAction({ coords: { latitude: 2, longitude: 3, speed: 4 } } as any));
            deviceOrientationService.orientationChanged.emit(1);

            expect(mapService.moveToWithCurrentZoom).not.toHaveBeenCalled();
        }
    ));
});