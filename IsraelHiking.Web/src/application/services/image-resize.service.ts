import { Injectable } from "@angular/core";
import piexif from "piexifjs";

import type { LatLngAlt, DataContainer, RouteSegmentData, MarkerData, RouteData } from "../models/models";

export interface IPiexifGPSHelper {
    dmsRationalToDeg(dmsArray: number[], ref: string): number;
}

export type IPiexifGPSIFD = {
    GPSLatitude: string;
    GPSLatitudeRef: string;
    GPSLongitude: string;
    GPSLongitudeRef: string;
};

export type PiexifObject = {
    GPS: any[];
};

export type PiexifImageIFD = {
    Orientation: number;
};

export interface IPiexif {
    GPSHelper: IPiexifGPSHelper;
    GPSIFD: IPiexifGPSIFD;
    ImageIFD: PiexifImageIFD;
    load(binaryStringData: string): PiexifObject;
    dump(exifObject: PiexifObject): any[];
    insert(exifBytes: any[], binaryStringData: string): string;
}

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
            // HM TODO: maybe the following fix is needed: https://github.com/ionic-team/capacitor/issues/1564
            reader.onload = (event: any) => {
                let exifData = null as any;
                if (file.type === ImageResizeService.JPEG) {
                    exifData = piexif.load(event.target.result);
                }
                let latLng = this.getGeoLocation(exifData);
                if (latLng == null && throwIfNoLocation) {
                    reject(new Error("Image does not contain geolocation information"));
                }
                let image = new Image();
                image.onload = () => {
                    let binaryStringData = this.resizeImageWithExif(image, exifData);
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
        if (isNaN(lat) || isNaN(lng)) {
            return null;
        }
        return { lat, lng };
    }

    private resizeImageWithExif(image: HTMLImageElement, exifData: any): string {
        let canvas = document.createElement("canvas") as HTMLCanvasElement;

        let maxSize = 1600; // in px for both height and width maximal size
        let width = image.naturalWidth;
        let height = image.naturalHeight;
        let ratio = maxSize / Math.max(width, height);
        if (ratio > 1) {
            ratio = 1;
        }
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        // There's no need to rotate the image since browsers do it automatically, only resize and change exif
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

        let dataUrl = canvas.toDataURL(ImageResizeService.JPEG, 0.92);
        if (exifData != null) {
            exifData["0th"][piexif.ImageIFD.Orientation] = 1;
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
