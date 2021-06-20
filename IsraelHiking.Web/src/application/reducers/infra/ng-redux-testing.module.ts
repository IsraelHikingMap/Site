import { NgModule } from "@angular/core";
import { NgRedux } from "./ng-redux.module";
import { MockNgRedux } from "./ng-redux.mock";

// Needs to be initialized early so @select's use the mocked version too.
const mockNgRedux = MockNgRedux.getInstance();

/** @hidden */
export const mockNgReduxFactory = () => mockNgRedux;

@NgModule({
  imports: [],
  providers: [
    { provide: NgRedux, useFactory: mockNgReduxFactory },
  ],
})
export class NgReduxTestingModule {}
export { MockNgRedux } from "./ng-redux.mock";
