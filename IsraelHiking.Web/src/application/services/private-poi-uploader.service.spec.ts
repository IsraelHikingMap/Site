import { describe, beforeEach, it, expect, vi, type Mock } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import { Router } from "@angular/router";
import { provideStore, Store } from "@ngxs/store";
import { v4 as uuidv4 } from "uuid";

import { ResourcesService } from "./resources.service";
import { PoiService } from "./poi.service";
import { ToastService } from "./toast.service";
import { RouteStrings } from "./hash.service";
import { PrivatePoiUploaderService } from "./private-poi-uploader.service";
import { PointsOfInterestReducer } from "../reducers/poi.reducer";
import type { ApplicationState, LatLngAltTime, LinkData, MarkerData } from "../models";

describe("Private Poi Uploader Service", () => {
    const latLng = { lat: 1, lng: 2 } as LatLngAltTime;
    const editQueryParams = { queryParams: { language: "he", edit: true } };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideStore([PointsOfInterestReducer]),
                {
                    provide: ResourcesService,
                    useValue: {
                        getCurrentLanguageCodeSimplified: () => "he",
                        translate: vi.fn((word: string) => word)
                    }
                },
                { provide: PoiService, useValue: { getClosestPoint: vi.fn().mockResolvedValue(null) } },
                { provide: Router, useValue: { navigate: vi.fn() } },
                { provide: ToastService, useValue: { warning: vi.fn(), confirm: vi.fn() } },
                PrivatePoiUploaderService
            ]
        });
    });

    function getUploadMarkerData(store: Store): MarkerData {
        return store.selectSnapshot((s: ApplicationState) => s.poiState).uploadMarkerData as MarkerData;
    }

    it("Should not upload the description of a marker that was copied from a public POI",
        inject([PrivatePoiUploaderService, Store], async (service: PrivatePoiUploaderService, store: Store) => {
            await service.uploadPoint("node_42", latLng, null, "title", "a description from the POI's page", "star");

            expect(getUploadMarkerData(store).description).toBe("");
        })
    );

    it("Should upload the description of a marker that was created by the user, trimmed to the maximal length",
        inject([PrivatePoiUploaderService, Store], async (service: PrivatePoiUploaderService, store: Store) => {
            const description = "a description the user wrote".padEnd(300, "!");

            await service.uploadPoint(uuidv4(), latLng, null, "title", description, "star");

            expect(getUploadMarkerData(store).description).toBe(description.substring(0, 255));
            expect(getUploadMarkerData(store).description).toContain("a description the user wrote");
        })
    );

    it("Should go to the edit page of an existing POI when the marker was copied from it",
        inject([PrivatePoiUploaderService, Store, Router, ToastService],
            async (service: PrivatePoiUploaderService, store: Store, router: Router, toastService: ToastService) => {
                await service.uploadPoint("way_42", latLng, null, "title", "description", "star");

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_POI, "OSM", "way_42"], editQueryParams);
                expect(getUploadMarkerData(store).id).toBe("way_42");
                expect(toastService.confirm).not.toHaveBeenCalled();
            })
    );

    it("Should not allow uploading a marker that was copied from a non-OSM source",
        inject([PrivatePoiUploaderService, Router, ToastService],
            async (service: PrivatePoiUploaderService, router: Router, toastService: ToastService) => {
                await service.uploadPoint("iNature_42", latLng, null, "title", "description", "star");

                expect(toastService.warning).toHaveBeenCalled();
                expect(router.navigate).not.toHaveBeenCalled();
            })
    );

    it("Should set an empty description when there's no description",
        inject([PrivatePoiUploaderService, Store], async (service: PrivatePoiUploaderService, store: Store) => {
            await service.uploadPoint(uuidv4(), latLng, null, "title", null, "star");

            expect(getUploadMarkerData(store).description).toBe("");
        })
    );

    it("Should add the image of the marker to the uploaded data",
        inject([PrivatePoiUploaderService, Store], async (service: PrivatePoiUploaderService, store: Store) => {
            const imageLink = { mimeType: "image/jpeg", url: "image-url", text: "" } as LinkData;

            await service.uploadPoint(uuidv4(), latLng, imageLink, "title", "description", "star");

            expect(getUploadMarkerData(store).urls).toEqual([imageLink]);
        })
    );

    it("Should go to the new POI page when there's no POI close by",
        inject([PrivatePoiUploaderService, PoiService, Router, ToastService],
            async (service: PrivatePoiUploaderService, poiService: PoiService, router: Router, toastService: ToastService) => {
                vi.spyOn(poiService, "getClosestPoint").mockResolvedValue(null);

                await service.uploadPoint(uuidv4(), latLng, null, "title", "description", "star");

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_POI, "new", ""], editQueryParams);
                expect(toastService.confirm).not.toHaveBeenCalled();
            })
    );

    it("Should ask the user whether to update a POI that is close by, describing it by its type when it has no title",
        inject([PrivatePoiUploaderService, PoiService, ResourcesService, Router, ToastService],
            async (service: PrivatePoiUploaderService, poiService: PoiService, resources: ResourcesService,
                router: Router, toastService: ToastService) => {
                vi.spyOn(poiService, "getClosestPoint").mockResolvedValue({ type: "waterfall", id: "node_42", title: "" });

                await service.uploadPoint(uuidv4(), latLng, null, "title", "description", "star");

                expect(resources.translate).toHaveBeenCalledWith("Waterfall");
                expect(toastService.confirm).toHaveBeenCalled();
                expect(router.navigate).not.toHaveBeenCalled();
            })
    );

    it("Should update the POI that is close by when the user confirms it",
        inject([PrivatePoiUploaderService, PoiService, Store, Router, ToastService],
            async (service: PrivatePoiUploaderService, poiService: PoiService, store: Store,
                router: Router, toastService: ToastService) => {
                vi.spyOn(poiService, "getClosestPoint").mockResolvedValue({ type: "waterfall", id: "node_42", title: "a close by POI" });

                await service.uploadPoint(uuidv4(), latLng, null, "title", "a description the user wrote", "star");
                (toastService.confirm as Mock).mock.calls[0][0].confirmAction();

                const markerData = getUploadMarkerData(store);
                expect(markerData.id).toBe("node_42");
                // The marker was created by the user, so the description should still be uploaded
                expect(markerData.description).toBe("a description the user wrote");
                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_POI, "OSM", "node_42"], editQueryParams);
            })
    );

    it("Should create a new POI when the user declines updating the POI that is close by",
        inject([PrivatePoiUploaderService, PoiService, Router, ToastService],
            async (service: PrivatePoiUploaderService, poiService: PoiService, router: Router, toastService: ToastService) => {
                vi.spyOn(poiService, "getClosestPoint").mockResolvedValue({ type: "waterfall", id: "node_42", title: "a close by POI" });

                await service.uploadPoint(uuidv4(), latLng, null, "title", "description", "star");
                (toastService.confirm as Mock).mock.calls[0][0].declineAction();

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_POI, "new", ""], editQueryParams);
            })
    );
});
