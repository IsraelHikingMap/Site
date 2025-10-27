import { TestBed, inject } from "@angular/core/testing";
import { expect, it, describe, beforeEach, vi } from "vitest";
import {dump, insert, TagValues, type IExif} from "piexif-ts";

import { ImageResizeService } from "./image-resize.service";
import { encode } from "base64-arraybuffer";

const IMAGE_BASE_64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/CABEIAAEAAQMBIgACEQEDEQH/xAAUAAEAAAAAAAAAAAAAAAAAAAAK/9oACAEBAAAAAH8f/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAhAAAAB//8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAxAAAAB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPwB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwB//9k=";

describe("ImageResizeService", () => {

    beforeEach(() => {
        const mockFileReader = vi.fn(() => ({
            readAsDataURL: function (blob: Blob) {
                const self = this;
                if (blob.arrayBuffer) {
                    blob.arrayBuffer().then(buffer => {
                        const dataBase64 = encode(buffer);
                        self.onload({ target: { result: `data:image/jpeg;base64,${dataBase64}` } });
                    });
                } else {
                    self.onload({ target: { result: blob } });
                }
            },
            onload: null
        }));

        // Replace the global FileReader with our mock
        vi.stubGlobal('FileReader', mockFileReader);

        TestBed.configureTestingModule({
            imports: [],
            providers: [
                ImageResizeService
            ]
        });

        Object.defineProperty(global.Image.prototype, 'src', {
            set(url: string) {
                if (url === 'error') {
                    this.onerror();
                } else if (this.onload) {
                    this.onload();
                }
            }
        });
    });

    it("Should fail to convert the image without location data", inject([ImageResizeService], async (service: ImageResizeService) => {
        await expect(service.resizeImageAndConvert(new Blob([""]) as File)).rejects.toThrow("Image does not contain geolocation information");
    }));

    it("Should not fail when 0th is missing", inject([ImageResizeService], async (service: ImageResizeService) => {
        const exifData: IExif = {};
        const exifbytes = dump(exifData);
        const dataUrl = insert(exifbytes, IMAGE_BASE_64);
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await expect(service.resizeImage(blob as File)).resolves.toBeDefined();
    }));

    it.skip("Should not fail when GPS values are empty", inject([ImageResizeService], async (service: ImageResizeService) => {
        const exifData: IExif = {
            GPS: {
                [TagValues.GPSIFD.GPSLatitude]: [[0, 1], [0, 1], [0, 1]],
                [TagValues.GPSIFD.GPSLongitude]: [[0, 1], [0, 1], [0, 1]], 
                [TagValues.GPSIFD.GPSLatitudeRef]: "",
                [TagValues.GPSIFD.GPSLongitudeRef]: "",
            }
        };
        const exifbytes = dump(exifData);
        const dataUrl = insert(exifbytes, IMAGE_BASE_64);
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await expect(service.resizeImageAndConvert(blob as File)).rejects.toThrow("Image does not contain geolocation information");
    }));

    it.skip("Should not fail when GPS values are bad", inject([ImageResizeService], async (service: ImageResizeService) => {
        const exifData: IExif = {
            GPS: {
                [TagValues.GPSIFD.GPSLatitude]: [[0, 0], [0, 1], [0, 1]],
                [TagValues.GPSIFD.GPSLongitude]: [[0, 0], [0, 1], [0, 1]], 
                [TagValues.GPSIFD.GPSLatitudeRef]: "S",
                [TagValues.GPSIFD.GPSLongitudeRef]: "W",
            }
        };
        const exifbytes = dump(exifData);
        const dataUrl = insert(exifbytes, IMAGE_BASE_64);
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await expect(service.resizeImageAndConvert(blob as File)).rejects.toThrow("Image does not contain geolocation information");
    }));

    it.skip("Should convert the image with location data", inject([ImageResizeService], async (service: ImageResizeService) => {
        const exifData: IExif = {
            GPS: {
                [TagValues.GPSIFD.GPSLatitude]: [[2, 1], [0, 1], [0, 1]],
                [TagValues.GPSIFD.GPSLongitude]: [[3, 1], [0, 1], [0, 1]], 
                [TagValues.GPSIFD.GPSLatitudeRef]: "S",
                [TagValues.GPSIFD.GPSLongitudeRef]: "W",
            }
        };
        const exifbytes = dump(exifData);
        const dataUrl = insert(exifbytes, IMAGE_BASE_64);
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const dataContainer = await service.resizeImageAndConvert(blob as File);
        expect(dataContainer.routes.length).toBe(1);
        expect(dataContainer.routes[0].markers.length).toBe(1);
        expect(dataContainer.routes[0].markers[0].latlng.lat).toBe(-2);
        expect(dataContainer.routes[0].markers[0].latlng.lng).toBe(-3);
    }));

});