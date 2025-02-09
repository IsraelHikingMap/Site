import { TestBed, inject } from "@angular/core/testing";
import {dump, insert, TagValues, type IExif} from "piexif-ts";

import { ImageResizeService } from "./image-resize.service";

describe("ImageResizeService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [],
            providers: [
                ImageResizeService
            ]
        });
    });

    it("Should fial to convert the image without location data", inject([ImageResizeService], async (service: ImageResizeService) => {
        const promise = service.resizeImageAndConvert(new Blob([""]) as File).catch(() => {
            expect(true).toBeTrue();
        });
        return promise;
    }));

    it("Should fial to convert the image without location data", inject([ImageResizeService], async (service: ImageResizeService) => {
        const exifData = {
            GPS: {
                [TagValues.GPSIFD.GPSLatitude]: [[2, 1], [0, 1], [0, 1]],
                [TagValues.GPSIFD.GPSLongitude]: [[3, 1], [0, 1], [0, 1]], 
                [TagValues.GPSIFD.GPSLatitudeRef]: "S",
                [TagValues.GPSIFD.GPSLongitudeRef]: "W",
            }
        } as IExif;
        const exifbytes = dump(exifData);
        const dataUrl = insert(exifbytes, "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/CABEIAAEAAQMBIgACEQEDEQH/xAAUAAEAAAAAAAAAAAAAAAAAAAAK/9oACAEBAAAAAH8f/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAhAAAAB//8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAxAAAAB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPwB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwB//9k=");
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const dataContainer = await service.resizeImageAndConvert(blob as File);
        expect(dataContainer.routes.length).toBe(1);
        expect(dataContainer.routes[0].markers.length).toBe(1);
        expect(dataContainer.routes[0].markers[0].latlng.lat).toBe(-2);
        expect(dataContainer.routes[0].markers[0].latlng.lng).toBe(-3);
    }));

});