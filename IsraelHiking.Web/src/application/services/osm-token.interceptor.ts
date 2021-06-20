import { Injectable } from "@angular/core";
import { HttpInterceptor, HttpHandler, HttpRequest, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs";

import { NgRedux } from "../reducers/infra/ng-redux.module";
import { ApplicationState } from "../models/models";
import { Urls } from "../urls";

@Injectable()
export class OsmTokenInterceptor implements HttpInterceptor {
    constructor(private readonly ngRedux: NgRedux<ApplicationState>) { }

    public intercept = (request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> => {
        let token = "";
        try {
            token = this.ngRedux.getState().userState.token;
        } catch (ex) {
            // store is not ready yet
        }

        if (token && request.url.indexOf(Urls.apiBase) !== -1) {
            request = request.clone({
                setHeaders: {
                    Authorization: `Bearer ${token}`
                }
            });
        }
        return next.handle(request);
    };
}
