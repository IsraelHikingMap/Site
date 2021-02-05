import { NgModule, NgZone } from "@angular/core";
import { NgRedux } from "./components/ng-redux";
import { RootStore } from "./components/root-store";

/** @hidden */
export function _ngReduxFactory(ngZone: NgZone) {
  return new RootStore(ngZone);
}

@NgModule({
  providers: [
    { provide: NgRedux, useFactory: _ngReduxFactory, deps: [NgZone] },
  ],
})
export class NgReduxModule {}
export { NgRedux } from "./components/ng-redux";
export { select } from "./decorators/select";
export { classToActionMiddleware, ReduxAction, createReducerFromClass, BaseAction } from "./decorators/reducer-action-decorator";
