import { Injectable } from "@angular/core";
import { saveAs } from "file-saver";
import b64toBlob from "b64-to-blob";
import piexif from "piexifjs";
import * as osmAuth from "osm-auth";

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

export interface IPiexif {
    GPSHelper: IPiexifGPSHelper;
    GPSIFD: IPiexifGPSIFD;
    load(binaryStringData: string): IPiexifObject;
    dump(exifObject: IPiexifObject): any[];
    insert(exifBytes: any[], binaryStringData: string): string;
}

@Injectable()
export class NonAngularObjectsFactory {

    public get b64ToBlob(): (data: string, mimeType: string) => Blob {
        return b64toBlob as (data: string, mimeType: string) => Blob;
    }

    public get saveAs(): (data: Blob, filename?: string, disableAutoBOM?: boolean) => void {
        return saveAs;
    }

    public createPiexif(): IPiexif {
        return piexif;
    }

    public createOsmAuth(options: OSMAuth.OSMAuthOptions): OSMAuth.OSMAuthInstance {
        return new osmAuth(options);
    }


}