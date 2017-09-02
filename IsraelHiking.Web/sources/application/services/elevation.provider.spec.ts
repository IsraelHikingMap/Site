import { TestBed, inject, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { HttpModule, Response, ResponseOptions, XHRBackend } from "@angular/http";
import { MockBackend, MockConnection } from "@angular/http/testing";
import * as L from "leaflet";

import { ResourcesService } from "./resources.service";
import { ElevationProvider } from "./elevation.provider";
import { ToastService } from "./toast.service";
import { ToastServiceMockCreator } from "./toast.service.spec";

describe("ElevationProvider", () => {

    beforeEach(() => {
        let toastMockCreator = new ToastServiceMockCreator();
        TestBed.configureTestingModule({
            imports: [HttpModule],
            providers: [
                { provide: ResourcesService, useValue: toastMockCreator.resourcesService },
                { provide: ToastService, useValue: toastMockCreator.toastService },
                { provide: XHRBackend, useClass: MockBackend },
                ElevationProvider,
            ]
        });
    });

    it("Should update height data", inject([ElevationProvider, XHRBackend], fakeAsync((elevationProvider: ElevationProvider, mockBackend: MockBackend) => {
        var latlngs = [L.latLng(0, 0, 0)];
        mockBackend.connections.subscribe((connection) => {
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify([1])
            })));
        });

        elevationProvider.updateHeights(latlngs);
        flushMicrotasks();

        expect(latlngs[0].alt).toBe(1);
    })));

    it("Should not call provider bacause all coordinates has elevation", inject([ElevationProvider], (elevationProvider: ElevationProvider) => {
        var latlngs = [L.latLng(0, 0, 1)];

        elevationProvider.updateHeights(latlngs);

        expect(latlngs[0].alt).toBe(1);
    }));

    it("Should raise toast when error occurs", inject([ElevationProvider, XHRBackend, ToastService], fakeAsync((elevationProvider: ElevationProvider, mockBackend: MockBackend, toastService: ToastService) => {
        var latlngs = [L.latLng(0, 0, 0)];
        mockBackend.connections.subscribe((connection: MockConnection) => {
            connection.mockError(new Error(""));
        });
        spyOn(toastService, "error");

        elevationProvider.updateHeights(latlngs).then(() => fail(), () => { });
        flushMicrotasks();

        expect(toastService.error).toHaveBeenCalled();
    })));
});