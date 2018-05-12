import { Injectable } from "@angular/core";
import { HttpInterceptor, HttpHandler, HttpRequest, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs/Observable";

import { AuthorizationService } from "./authorization.service";

@Injectable()
export class OsmTokenInterceptor implements HttpInterceptor {
    constructor(public authorizationService: AuthorizationService) { }

    public intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        if (this.authorizationService.osmToken) {
            request = request.clone({
                setHeaders: {
                    Authorization: `Bearer ${this.authorizationService.osmToken}`
                }
            });
        }
        return next.handle(request);
    }
}