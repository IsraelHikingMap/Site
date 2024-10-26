import { EventEmitter } from "@angular/core";
import { inject, TestBed } from "@angular/core/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { LocationService } from "./location.service";
import { GeoLocationService } from "./geo-location.service";
import { DeviceOrientationService } from "./device-orientation.service";
import { FitBoundsService } from "./fit-bounds.service";
import { MapService } from "./map.service";
import { LoggingService } from "./logging.service";
import { GpsReducer, SetCurrentPositionAction } from "../reducers/gps.reducer";
import { InMemoryReducer } from "../reducers/in-memory.reducer";

describe("LocationService", () => {

    beforeEach(() => {
        const geoLocationService = {
            backToForeground: {
                subscribe: () => { }
            },
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
        const fitBoundsService = {
            moveTo: jasmine.createSpy("moveTo")
        };
        const mapService = {
            map: {
                isMoving: () => false,
                getZoom: () => 0
            }
        };
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([InMemoryReducer, GpsReducer])],
            providers: [
                { provide: GeoLocationService, useValue: geoLocationService },
                { provide: DeviceOrientationService, useValue: deviceOrientationService },
                { provide: FitBoundsService, useValue: fitBoundsService },
                { provide: MapService, useValue: mapService },
                { provide: LoggingService, useValue: {} },
                LocationService
            ]
        });
    });

    it("Should initialize without any failures", inject([LocationService], (service: LocationService) => {
        expect(() => service.initialize()).not.toThrow();
    }));

    it("Should call disable of services when disabled", inject([LocationService, GeoLocationService, DeviceOrientationService], 
        (service: LocationService, geoLocationService: GeoLocationService, deviceOrientationService: DeviceOrientationService) => {
            service.disable();

            expect(geoLocationService.disable).toHaveBeenCalled();
            expect(deviceOrientationService.disable).toHaveBeenCalled();
    }));

    it("Should call enable of services when enabled", inject([LocationService, GeoLocationService, DeviceOrientationService], 
        (service: LocationService, geoLocationService: GeoLocationService, deviceOrientationService: DeviceOrientationService) => {
            service.enable();

            expect(geoLocationService.enable).toHaveBeenCalled();
            expect(deviceOrientationService.enable).toHaveBeenCalled();
    }));

    it("Should not move to gps position if position is not defined", inject([LocationService, FitBoundsService], (service: LocationService, fitBoundsService: FitBoundsService) => {
        service.moveMapToGpsPosition();

        expect(fitBoundsService.moveTo).not.toHaveBeenCalled();
    }));

    it("Should move to gps position if a new valid position is received", inject([LocationService, FitBoundsService, Store], 
        (service: LocationService, fitBoundsService: FitBoundsService, store: Store) => {
        store.reset({ 
            gpsState: { currentPosition: null },
            inMemoryState: { following: false }
        });
        service.initialize();
        const eventSpy = jasmine.createSpy();
        service.changed.subscribe(eventSpy);
        store.dispatch(new SetCurrentPositionAction({coords: {latitude: 1, longitude: 2}} as any));
        store.dispatch(new SetCurrentPositionAction({coords: {latitude: 2, longitude: 3}} as any));

        expect(eventSpy).toHaveBeenCalled();
        expect(fitBoundsService.moveTo).toHaveBeenCalled();
    }));

    it("Should move to gps position with heading from gps", inject([LocationService, FitBoundsService, Store], 
        (service: LocationService, fitBoundsService: FitBoundsService, store: Store) => {
        store.reset({ 
            gpsState: { currentPosition: null },
            inMemoryState: { following: false }
        });
        service.initialize();
        const eventSpy = jasmine.createSpy();
        service.changed.subscribe(eventSpy);
        store.dispatch(new SetCurrentPositionAction({coords: {latitude: 1, longitude: 2}} as any));
        store.dispatch(new SetCurrentPositionAction({coords: {latitude: 2, longitude: 3, speed: 3, heading: 4}} as any));

        expect(eventSpy).toHaveBeenCalled();
        expect(fitBoundsService.moveTo).toHaveBeenCalledWith({lat: 2, lng: 3, alt: undefined}, 0, 4);
    }));

    it("Should move to gps position with heading 0 when keep north up", inject([LocationService, FitBoundsService, Store], 
        (service: LocationService, fitBoundsService: FitBoundsService, store: Store) => {
        store.reset({ 
            gpsState: { currentPosition: null },
            inMemoryState: { following: false, keepNorthUp: true }
        });
        service.initialize();
        const eventSpy = jasmine.createSpy();
        service.changed.subscribe(eventSpy);
        store.dispatch(new SetCurrentPositionAction({coords: {latitude: 1, longitude: 2}} as any));
        store.dispatch(new SetCurrentPositionAction({coords: {latitude: 2, longitude: 3, speed: 3, heading: 4}} as any));

        expect(eventSpy).toHaveBeenCalled();
        expect(fitBoundsService.moveTo).toHaveBeenCalledWith({lat: 2, lng: 3, alt: undefined}, 0, 0);
    }));

    it("Should not move to gps position when given invalid location", inject([LocationService, FitBoundsService, Store], 
        (service: LocationService, fitBoundsService: FitBoundsService, store: Store) => {
        store.reset({ 
            gpsState: { currentPosition: null },
            inMemoryState: { following: false }
        });
        service.initialize();
        const eventSpy = jasmine.createSpy();
        service.changed.subscribe(eventSpy);
        store.dispatch(new SetCurrentPositionAction({coords: {latitude: NaN, longitude: NaN}} as any));

        expect(eventSpy).not.toHaveBeenCalled();
        expect(fitBoundsService.moveTo).not.toHaveBeenCalled();
    }));

    it("Should not do anything on orientation change and no location", inject([LocationService, DeviceOrientationService], 
        (service: LocationService, deviceOrientationService: DeviceOrientationService) => {
        service.initialize();
        const eventSpy = jasmine.createSpy();
        service.changed.subscribe(eventSpy);
        deviceOrientationService.orientationChanged.emit(1);

        expect(eventSpy).not.toHaveBeenCalled();
    }));

    it("Should not do anything on orientation change and not in active state", inject([LocationService, DeviceOrientationService, Store], 
        (service: LocationService, deviceOrientationService: DeviceOrientationService, store: Store) => {
        store.reset({ 
            gpsState: { 
                currentPosition: null,
                tracking: "searching"
            },
            inMemoryState: { following: true }
        });
        service.initialize();
        const eventSpy = jasmine.createSpy();
        service.changed.subscribe(eventSpy);
        store.dispatch(new SetCurrentPositionAction({coords: {latitude: 1, longitude: 2}} as any));
        deviceOrientationService.orientationChanged.emit(1);

        expect(eventSpy).not.toHaveBeenCalledTimes(2);
    }));

    it("Should not do anything on orientation change and last update time was recent", inject([LocationService, DeviceOrientationService, Store], 
        (service: LocationService, deviceOrientationService: DeviceOrientationService, store: Store) => {
        store.reset({ 
            gpsState: { 
                currentPosition: null,
                tracking: "searching"
            },
            inMemoryState: { following: true }
        });
        service.initialize();
        const eventSpy = jasmine.createSpy();
        service.changed.subscribe(eventSpy);
        store.dispatch(new SetCurrentPositionAction({coords: {latitude: 1, longitude: 2, speed: 3, heading: 4}} as any));
        deviceOrientationService.orientationChanged.emit(5);

        expect(eventSpy).not.toHaveBeenCalledTimes(2);
    }));

    it("Should fire orientation change when in active state", inject([LocationService, DeviceOrientationService, Store], 
        (service: LocationService, deviceOrientationService: DeviceOrientationService, store: Store) => {
        console.log("start test");
        store.reset({ 
            gpsState: { 
                currentPosition: null,
                tracking: "tracking"
            },
            inMemoryState: { following: true }
        });
        service.initialize();
        const eventSpy = jasmine.createSpy();
        service.changed.subscribe(eventSpy);
        store.dispatch(new SetCurrentPositionAction({coords: {latitude: 2, longitude: 3}} as any));
        deviceOrientationService.orientationChanged.emit(5);

        expect(eventSpy).toHaveBeenCalledTimes(2);
    }));
});