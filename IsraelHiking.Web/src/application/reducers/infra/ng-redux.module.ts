import { NgModule, NgZone } from "@angular/core";
import { NgRedux } from "./components/ng-redux";
import { RootStore } from "./components/root-store";

/** @hidden */
export const ngReduxFactory = (ngZone: NgZone) => new RootStore(ngZone);

@NgModule({
  providers: [
    { provide: NgRedux, useFactory: ngReduxFactory, deps: [NgZone] },
  ],
})
export class NgReduxModule {}
export { NgRedux } from "./components/ng-redux";
export { select } from "./decorators/select";
export { classToActionMiddleware, ReduxAction, createReducerFromClass, BaseAction } from "./decorators/reducer-action-decorator";
