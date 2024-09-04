import { TestBed, inject } from "@angular/core/testing";
import { NgxsModule } from "@ngxs/store";

import { FitBoundsService } from "./fit-bounds.service";
import { SidebarService } from "./sidebar.service";
import { MapService } from "./map.service";
import { LngLat } from "maplibre-gl";

describe("FitBoundsService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([])
            ],
            providers: [
                { provide: SidebarService, useValue: { } },
                { provide: MapService, useValue: { 
                    initializationPromise: Promise.resolve(),
                    map: {
                        getZoom: () => 1
                    }
                } },
                FitBoundsService
            ]
        });
    });

    it("Should fit bounds when sidebar serive is open with padding", inject([FitBoundsService, SidebarService, MapService], 
        async (service: FitBoundsService, sidebarService: SidebarService, mapService: MapService) => {
            sidebarService.isSidebarOpen = () => true;
            const spy = jasmine.createSpy();
            mapService.map.fitBounds = spy;
            await service.fitBounds({ northEast: { lat: 1, lng: 1}, southWest: { lat: 2, lng: 2}});
            console.log(spy.calls.all()[0].args[1]);
            expect(spy.calls.all()[0].args[1].padding.left).toBe(400);
    }));

    it("Should fit bounds when sidebar serive is closed without padding", inject([FitBoundsService, SidebarService, MapService], 
        async (service: FitBoundsService, sidebarService: SidebarService, mapService: MapService) => {
            sidebarService.isSidebarOpen = () => false;
            const spy = jasmine.createSpy();
            mapService.map.fitBounds = spy;
            await service.fitBounds({ northEast: { lat: 1, lng: 1}, southWest: { lat: 2, lng: 2}}, true);
            expect(spy.calls.all()[0].args[1].padding).toBe(0);
    }));

    it("Should not fly to on small changes", inject([FitBoundsService, SidebarService, MapService], 
        async (service: FitBoundsService, sidebarService: SidebarService, mapService: MapService) => {
            mapService.map.getCenter = () => { return { lat: 1, lng: 1} as LngLat};
            const spy = jasmine.createSpy();
            mapService.map.flyTo = spy;
            await service.flyTo({lng: 1, lat: 1}, 1);
            expect(spy).not.toHaveBeenCalled();
    }));

    it("Should fly to on large changes", inject([FitBoundsService, MapService], 
        async (service: FitBoundsService, mapService: MapService) => {
            mapService.map.getCenter = () => { return { lat: 1, lng: 1} as LngLat};
            const spy = jasmine.createSpy();
            mapService.map.flyTo = spy;
            await service.flyTo({lng: 2, lat: 2}, 1);
            expect(spy).toHaveBeenCalled();
    }));

    it("Should move to", inject([FitBoundsService, MapService], 
        async (service: FitBoundsService, mapService: MapService) => {
            const spy = jasmine.createSpy();
            mapService.map.easeTo = spy;
            await service.moveTo({lng: 2, lat: 2}, 1, 1);
            expect(spy).toHaveBeenCalled();
    }));
});