import { describe, beforeEach, it, expect } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import { dump, insert, TagValues, type IExif } from "piexif-ts";
import { decode } from "base64-arraybuffer";

import { ImageResizeService } from "./image-resize.service";

const IMAGE_BASE_64 =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/CABEIAAEAAQMBIgACEQEDEQH/xAAUAAEAAAAAAAAAAAAAAAAAAAAK/9oACAEBAAAAAH8f/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAhAAAAB//8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAxAAAAB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPwB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwB//9k=";

function dataUrlToBlob(dataUrl: string): Blob {
    const base64Url = dataUrl.split(",")[1];
    const buffer = decode(base64Url);
    return new Blob([buffer], { type: "image/jpeg" });
}

describe("ImageResizeService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [],
            providers: [ImageResizeService],
        });
    });

    it("Should fial to convert the image without location data", inject(
        [ImageResizeService],
        async (service: ImageResizeService) => {
            await expect(
                service.resizeImageAndConvert(new Blob([""]) as File)
            ).rejects.toThrow();
        }
    ));

    it("Should not fail when 0th is missing", inject(
        [ImageResizeService],
        async (service: ImageResizeService) => {
            const exifData: IExif = {};
            const exifbytes = dump(exifData);
            const dataUrl = insert(exifbytes, IMAGE_BASE_64);
            const blob = dataUrlToBlob(dataUrl);
            await expect(service.resizeImage(blob as File)).resolves.not.toThrow();
        }
    ));

    it("Should not fail when GPS values are empty", inject(
        [ImageResizeService],
        async (service: ImageResizeService) => {
            const exifData: IExif = {
                GPS: {
                    [TagValues.GPSIFD.GPSLatitude]: [
                        [0, 1],
                        [0, 1],
                        [0, 1],
                    ],
                    [TagValues.GPSIFD.GPSLongitude]: [
                        [0, 1],
                        [0, 1],
                        [0, 1],
                    ],
                    [TagValues.GPSIFD.GPSLatitudeRef]: "",
                    [TagValues.GPSIFD.GPSLongitudeRef]: "",
                },
            };
            const exifbytes = dump(exifData);
            const dataUrl = insert(exifbytes, IMAGE_BASE_64);
            const blob = dataUrlToBlob(dataUrl);
            await expect(
                service.resizeImageAndConvert(blob as File)
            ).rejects.toThrowError("Image does not contain geolocation information");
        }
    ));

    it("Should not fail when GPS values are bad", inject(
        [ImageResizeService],
        async (service: ImageResizeService) => {
            const exifData: IExif = {
                GPS: {
                    [TagValues.GPSIFD.GPSLatitude]: [
                        [0, 0],
                        [0, 1],
                        [0, 1],
                    ],
                    [TagValues.GPSIFD.GPSLongitude]: [
                        [0, 0],
                        [0, 1],
                        [0, 1],
                    ],
                    [TagValues.GPSIFD.GPSLatitudeRef]: "S",
                    [TagValues.GPSIFD.GPSLongitudeRef]: "W",
                },
            };
            const exifbytes = dump(exifData);
            const dataUrl = insert(exifbytes, IMAGE_BASE_64);
            const blob = dataUrlToBlob(dataUrl);
            await expect(
                service.resizeImageAndConvert(blob as File)
            ).rejects.toThrowError("Image does not contain geolocation information");
        }
    ));

    it("Should convert the image with location data", inject(
        [ImageResizeService],
        async (service: ImageResizeService) => {
            const exifData: IExif = {
                GPS: {
                    [TagValues.GPSIFD.GPSLatitude]: [
                        [2, 1],
                        [0, 1],
                        [0, 1],
                    ],
                    [TagValues.GPSIFD.GPSLongitude]: [
                        [3, 1],
                        [0, 1],
                        [0, 1],
                    ],
                    [TagValues.GPSIFD.GPSLatitudeRef]: "S",
                    [TagValues.GPSIFD.GPSLongitudeRef]: "W",
                },
            };
            const exifbytes = dump(exifData);
            const dataUrl = insert(exifbytes, IMAGE_BASE_64);
            const blob = dataUrlToBlob(dataUrl);
            const dataContainer = await service.resizeImageAndConvert(blob as File);
            expect(dataContainer.routes.length).toBe(1);
            expect(dataContainer.routes[0].markers.length).toBe(1);
            expect(dataContainer.routes[0].markers[0].latlng.lat).toBe(-2);
            expect(dataContainer.routes[0].markers[0].latlng.lng).toBe(-3);
        }
    ));
});
