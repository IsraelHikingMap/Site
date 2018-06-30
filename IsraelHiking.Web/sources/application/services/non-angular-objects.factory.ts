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

    public b64ToBlob(data: string, contentType?: string): Blob {
        if (data.startsWith("data")) {
            let mime = data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,(.*)/);
            contentType = mime[1];
            data = mime[2];
        }
        return b64toBlob(data, contentType);
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