// tslint:disable:max-classes-per-file

import { NgZone } from "@angular/core";
import { Action } from "redux";

import { Observable } from "rxjs";
import { take, toArray } from "rxjs/operators";

import { NgRedux } from "../components/ng-redux";
import { RootStore } from "../components/root-store";
import { select } from "./select";

interface AppState {
  foo: string;
  baz: number;
}

type PayloadAction = Action & { payload?: any };

class MockNgZone {
  run = (fn: () => void) => fn();
}

describe("Select decorators", () => {
  let ngRedux: NgRedux<AppState>;

  const mockNgZone = (new MockNgZone() as any) as NgZone;
  const defaultState = { foo: "bar", baz: -1 };

  const rootReducer = (state = defaultState, action: PayloadAction) =>
    action.payload ? { ...state, baz: action.payload } : state;

  beforeEach(() => {
    ngRedux = new RootStore<AppState>(mockNgZone);
    NgRedux.instance = ngRedux;
    ngRedux.configureStore(rootReducer, defaultState);
  });

  describe("@select", () => {
    describe("when passed no arguments", () => {
      it("binds to a store property that matches the name of the class property", done => {
        class MockClass {
          @select() baz!: Observable<number>;
        }
        const mockInstance = new MockClass();

        mockInstance.baz
          .pipe(
            take(2),
            toArray(),
          )
          .subscribe({
            next: values => expect(values).toEqual([-1, 1]),
            error: undefined,
            complete: done
          });
        ngRedux.dispatch({ type: "nvm", payload: 1 });
      });

      it("binds by name ignoring any $ characters in the class property name", done => {
        class MockClass {
          @select() baz$!: Observable<number>;
        }
        const mockInstance = new MockClass();

        mockInstance.baz$
          .pipe(
            take(2),
            toArray(),
          )
          .subscribe({
            next: values => expect(values).toEqual([-1, 4]),
            error: undefined,
            complete: done
          });
        ngRedux.dispatch({ type: "nvm", payload: 4 });
      });
    });

    describe("when passed a string", () => {
      it("binds to the store property whose name matches the string value", done => {
        class MockClass {
          @select("baz") obs$!: Observable<number>;
        }
        const mockInstance = new MockClass();

        mockInstance.obs$
          .pipe(
            take(2),
            toArray(),
          )
          .subscribe({
            next: values => expect(values).toEqual([-1, 3]),
            error: undefined,
            complete: done,
          });
        ngRedux.dispatch({ type: "nvm", payload: 3 });
      });
    });

    describe("when passed a function", () => {
      it("attempts to use that function as the selector function", done => {
        const selector = (state: AppState) => state.baz * 2;
        class MockClass {
          @select(selector) obs$!: Observable<number>;
        }
        const mockInstance = new MockClass();

        mockInstance.obs$
          .pipe(
            take(2),
            toArray(),
          )
          .subscribe({
            next: values => expect(values).toEqual([-2, 10]),
            error: undefined,
            complete: done
          });
        ngRedux.dispatch({ type: "nvm", payload: 5 });
      });
    });

    describe("when passed a comparator", () => {
      const comparator = (_: any, y: any): boolean => y === 1;
      class MockClass {
        @select("baz", comparator)
        baz$!: Observable<number>;
      }

      it("should only trigger next when comparator returns true", done => {
        const mockInstance = new MockClass();
        mockInstance.baz$
          .pipe(
            take(2),
            toArray(),
          )
          .subscribe({
            next: values => expect(values).toEqual([-1, 2]),
            error: undefined,
            complete: done
          });
        ngRedux.dispatch({ type: "nvm", payload: 1 });
        ngRedux.dispatch({ type: "nvm", payload: 2 });
      });

      it("should receive previous and next value for comparison", done => {
        const spy = jasmine.createSpy("spy");
        class LocalMockClass {
          @select("baz", spy)
          baz$!: Observable<number>;
        }

        const mockInstance = new LocalMockClass();
        mockInstance.baz$.pipe(take(3)).subscribe({
          next: undefined,
          error: undefined,
          complete: done
        });

        ngRedux.dispatch({ type: "nvm", payload: 1 });
        ngRedux.dispatch({ type: "nvm", payload: 2 });

        expect(spy).toHaveBeenCalledWith(-1, 1);
        expect(spy).toHaveBeenCalledWith(1, 2);
      });
    });
  });
});
