import { describe, beforeEach, vi, it, expect } from "vitest";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";

import { DragAndDropService } from "./drag-and-drop.service";
import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { RouteStrings } from "./hash.service";
import { ToastService } from "./toast.service";

describe("DragAndDropService", () => {
    const drop = (dataTransfer: DataTransfer) => document.dispatchEvent(new DragEvent("drop", { dataTransfer }));

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                DragAndDropService,
                { provide: FileService, useValue: { addRoutesFromFile: vi.fn(), addRoutesFromUrl: vi.fn() } },
                { provide: ResourcesService, useValue: {} },
                { provide: ToastService, useValue: { error: vi.fn() } },
                { provide: Router, useValue: { navigate: vi.fn() } }
            ]
        });
        TestBed.inject(DragAndDropService).initialize();
    });

    it("Should show the map before adding a dropped file", async () => {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File(["<gpx/>"], "route.gpx"));

        drop(dataTransfer);

        await vi.waitFor(() => expect(TestBed.inject(FileService).addRoutesFromFile).toHaveBeenCalled());
        expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_MAP]);
    });

    it("Should show the map before adding a dropped url", async () => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text", "https://mapeak.com/route.gpx");

        drop(dataTransfer);

        await vi.waitFor(() => expect(TestBed.inject(FileService).addRoutesFromUrl)
            .toHaveBeenCalledWith("https://mapeak.com/route.gpx"));
        expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_MAP]);
    });

    it("Should do nothing when there is nothing to add", async () => {
        drop(new DataTransfer());

        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
        expect(TestBed.inject(FileService).addRoutesFromFile).not.toHaveBeenCalled();
    });
});
