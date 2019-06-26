import { Injectable } from "@angular/core";
import { saveAs } from "file-saver";
import b64toBlob from "b64-to-blob";
import * as ohauth from "ohauth";

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

    public createOhAuth() {
        return ohauth;
    }
}
