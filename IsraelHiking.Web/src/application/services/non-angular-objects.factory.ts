import { Injectable } from "@angular/core";
import { saveAs, FileSaverOptions } from "file-saver";
import b64toBlob from "b64-to-blob";
import * as ohauth from "ohauth";

export interface IOAuthResponse {
    oauth_token: string;
    oauth_token_secret: string;
}

export interface IOAuthParams {
    oauth_consumer_key: string;
    oauth_signature_method: string;
    oauth_timestamp: number;
    oauth_nonce: string;
    oauth_token: string;
    oauth_signature: string;
}

export interface IOhAuth {
    signature: (authSecret: string, tokenSecret: string, parameters: string) => string;
    baseString: (method: string, url: string, params: IOAuthParams) => string;
    /**
     * generates a querystring from an object
     */
    qsString: (obj: {}) => string;
    /**
     * generate an object from a querystring
     */
    stringQs: (str: string) => IOAuthResponse;
    timestamp: () => number;
    nonce: () => string;
    xhr: (method: string, url: string, params: {}, data: {}, options: {}, callback: (err, xhr) => void) => void;
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

    public saveAsWrapper(data: Blob, filename?: string, options?: FileSaverOptions): void {
        saveAs(data, filename, options);
    }

    public createOhAuth(): IOhAuth {
        return ohauth;
    }
}
