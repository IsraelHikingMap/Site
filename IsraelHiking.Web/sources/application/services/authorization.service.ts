import { Injectable } from "@angular/core";
import { LocalStorage } from "ngx-store";
import * as osmAuth from "osm-auth";

@Injectable()
export class AuthorizationService {

    @LocalStorage()
    public osmToken: string = null;

    public createOSMAuth(options: OSMAuth.OSMAuthOptions): OSMAuth.OSMAuthInstance {
        return new osmAuth(options);
    }
}