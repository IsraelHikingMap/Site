import { Injectable } from "@angular/core";
import piexif from "piexifjs";

export interface IPiexifGPSHelper {
    dmsRationalToDeg(dmsArray: number[], ref: string): number;
}

export interface IPiexifGPSIFD {
    GPSLatitude: string;
    GPSLatitudeRef: string;
    GPSLongitude: string;
    GPSLongitudeRef: string;
}

export interface IPiexifObject {
    GPS: any[];
}

export interface IPiexifImageIFD {
    Orientation: number;
}

export interface IPiexif {
    GPSHelper: IPiexifGPSHelper;
    GPSIFD: IPiexifGPSIFD;
    ImageIFD: IPiexifImageIFD;
    load(binaryStringData: string): IPiexifObject;
    dump(exifObject: IPiexifObject): any[];
    insert(exifBytes: any[], binaryStringData: string): string;
}

import { LatLngAlt, DataContainer, RouteSegmentData, MarkerData, RouteData } from "../models/models";

@Injectable()
export class ImageResizeService {
    public static readonly JPEG = "image/jpeg";

    public resizeImage(file: File): Promise<string> {
        return this.resizeImageAndConvertToAny<string>(file, data => data, false);
    }

    public resizeImageAndConvert(file: File, throwIfNoLocation = true): Promise<DataContainer> {
        return this.resizeImageAndConvertToAny<DataContainer>(file, this.createDataContainerFromBinaryString, throwIfNoLocation);
    }

    private resizeImageAndConvertToAny<TReturn>(file: File,
                                                convertMethod: (data: string, name: string, geoLocation: LatLngAlt) => TReturn,
                                                throwIfNoLocation = true): Promise<TReturn> {
        return new Promise<TReturn>((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = (event: any) => {
                let exifData = null;
                if (file.type === ImageResizeService.JPEG) {
                    exifData = piexif.load(event.target.result);
                }
                let latLng = this.getGeoLocation(exifData);
                if (latLng == null && throwIfNoLocation) {
                    reject(new Error("Image does not contain geolocation information"));
                }
                let image = new Image();
                image.onload = () => {
                    let binaryStringData = this.orientAndResizeImage(image, exifData);
                    let data = convertMethod(binaryStringData, file.name, latLng);
                    resolve(data);
                };
                image.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    private getGeoLocation(exifData: any): LatLngAlt {
        if (exifData == null || exifData.GPS == null ||
            Object.keys(exifData.GPS).length === 0 ||
            !exifData.GPS.hasOwnProperty(piexif.GPSIFD.GPSLatitude) ||
            !exifData.GPS.hasOwnProperty(piexif.GPSIFD.GPSLongitude)) {
            return null;
        }
        let lat = piexif.GPSHelper.dmsRationalToDeg(exifData.GPS[piexif.GPSIFD.GPSLatitude],
            exifData.GPS[piexif.GPSIFD.GPSLatitudeRef]);
        let lng = piexif.GPSHelper.dmsRationalToDeg(exifData.GPS[piexif.GPSIFD.GPSLongitude],
            exifData.GPS[piexif.GPSIFD.GPSLongitudeRef]);
        return { lat, lng };
    }

    private getAndUpdateOrientation(exifData: any) {
        if (exifData == null) {
            return 1;
        }
        let orientation = exifData["0th"][piexif.ImageIFD.Orientation];
        exifData["0th"][piexif.ImageIFD.Orientation] = 1;
        return orientation;
    }

    private orientAndResizeImage(image: HTMLImageElement, exifData): string {
        let orientation = this.getAndUpdateOrientation(exifData);

        let canvas = document.createElement("canvas") as HTMLCanvasElement;
        let context = canvas.getContext("2d");

        let maxSize = 1600; // in px for both height and width maximal size
        let width = image.naturalWidth;
        let height = image.naturalHeight;
        let ratio = maxSize / Math.max(width, height);
        if (ratio > 1) {
            ratio = 1;
        }
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        let x = 0;
        let y = 0;

        width = canvas.width;
        height = canvas.height;
        if (orientation > 4) {
            canvas.width = height;
            canvas.height = width;
        }
        context.save();
        switch (orientation) {
        case 2:
            x = -canvas.width;
            context.scale(-1, 1);
            break;
        case 3:
            x = -canvas.width;
            y = -canvas.height;
            context.scale(-1, -1);
            break;
        case 4:
            y = -canvas.height;
            context.scale(1, -1);
            break;
        case 5:
            context.translate(canvas.width, canvas.height / canvas.width);
            context.rotate(Math.PI / 2);
            y = -canvas.width;
            context.scale(1, -1);
            break;
        case 6:
            context.translate(canvas.width, canvas.height / canvas.width);
            context.rotate(Math.PI / 2);
            break;
        case 7:
            context.translate(canvas.width, canvas.height / canvas.width);
            context.rotate(Math.PI / 2);
            x = -canvas.height;
            context.scale(-1, 1);
            break;
        case 8:
            context.translate(canvas.width, canvas.height / canvas.width);
            context.rotate(Math.PI / 2);
            x = -canvas.height;
            y = -canvas.width;
            context.scale(-1, -1);
            break;
        }
        context.drawImage(image, x, y, width, height);
        context.restore();

        let dataUrl = canvas.toDataURL(ImageResizeService.JPEG, 0.92);
        if (exifData != null) {
            let exifbytes = piexif.dump(exifData);
            dataUrl = piexif.insert(exifbytes, dataUrl);
        }
        return dataUrl;
    }

    private createDataContainerFromBinaryString(binaryStringData: string, name: string, latLng: LatLngAlt) {
        return {
            northEast: latLng,
            southWest: latLng,
            routes: [
                {
                    segments: [] as RouteSegmentData[],
                    markers: [
                        {
                            title: name,
                            latlng: latLng,
                            type: "star",
                            urls: [
                                {
                                    mimeType: ImageResizeService.JPEG,
                                    url: binaryStringData
                                }
                            ]
                        }
                    ] as MarkerData[]
                }
            ] as RouteData[]
        } as DataContainer;
    }
}
