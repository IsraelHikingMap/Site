// TODO: See if this linting rule can be enabled with new build process (ng-packagr)
// tslint:disable:no-implicit-dependencies
import { NgModule } from "@angular/core";
import { NgRedux } from "./ng-redux.module";
import { MockNgRedux } from "./ng-redux.mock";

// Needs to be initialized early so @select's use the mocked version too.
const mockNgRedux = MockNgRedux.getInstance();

/** @hidden */
export function _mockNgReduxFactory() {
  return mockNgRedux;
}

@NgModule({
  imports: [],
  providers: [
    { provide: NgRedux, useFactory: _mockNgReduxFactory },
  ],
})
export class NgReduxTestingModule {}
export { MockNgRedux } from "./ng-redux.mock";
