import { Injectable } from "@angular/core";
import { LocalStorage } from "ngx-store";

@Injectable()
export class AuthorizationService {

    @LocalStorage()
    public osmToken: string = null;
}