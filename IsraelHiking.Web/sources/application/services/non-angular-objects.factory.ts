import { Injectable } from "@angular/core";
import { saveAs, FileSaverOptions } from "file-saver";
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

    public saveAsWrapper(data: Blob, filename?: string, options?: FileSaverOptions): void {
        saveAs(data, filename, options);
    }

    public createOhAuth() {
        return ohauth;
    }
}
