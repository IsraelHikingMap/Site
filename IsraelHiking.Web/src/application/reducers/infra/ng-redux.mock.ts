import {
  Comparator,
  PathSelector,
  Selector,
} from "./components/selectors";
import { NgRedux } from "./ng-redux.module";
import {
  AnyAction,
  Dispatch,
  Middleware,
  Reducer,
  Store,
  StoreEnhancer,
} from "redux";
import { Observable, Subject, ReplaySubject } from "rxjs";
import { distinctUntilChanged } from "rxjs/operators";

/** @hidden */
export interface SelectorStubRecord {
  subject: Subject<any>;
  comparator: Comparator;
}

/** @hidden */
export interface SelectorStubMap {
  [selector: string]: SelectorStubRecord;
}

/** @hidden */
export interface SubStoreStubMap {
  [basePath: string]: MockObservableStore<any>;
}

/** @hidden */
export class MockObservableStore<State> {
  selections: SelectorStubMap = {};
  subStores: SubStoreStubMap = {};

  getSelectorStub = <SelectedState>(
    selector?: Selector<State, SelectedState>,
    comparator?: Comparator,
  ): Subject<SelectedState> =>
    this.initSelectorStub<SelectedState>(selector, comparator).subject;

  reset = () => {
    Object.keys(this.subStores).forEach(k => this.subStores[k].reset());
    this.selections = {};
    this.subStores = {};
  };

  dispatch: Dispatch<AnyAction> = action => action;
  replaceReducer = () => null;
  getState = () => ({});
  subscribe = () => () => null;

  select = <SelectedState>(
    selector?: Selector<any, SelectedState>,
    comparator?: Comparator,
  ): Observable<any> => {
    const stub = this.initSelectorStub<SelectedState>(selector, comparator);
    return stub.comparator
      ? stub.subject.pipe(distinctUntilChanged(stub.comparator))
      : stub.subject;
  };

  configureSubStore = <SubState>(
    basePath: PathSelector,
    _: Reducer<SubState, AnyAction>,
  ): MockObservableStore<SubState> => this.initSubStore<SubState>(basePath);

  getSubStore = <SubState>(
    ...pathSelectors: PathSelector[]
  ): MockObservableStore<any> => {
    const [first, ...rest] = pathSelectors;
    return (first
      ? this.initSubStore(first).getSubStore(...rest)
      : this) as MockObservableStore<SubState>;
  };

  private initSubStore<SubState>(basePath: PathSelector) {
    const result =
      this.subStores[JSON.stringify(basePath)] ||
      new MockObservableStore<SubState>();
    this.subStores[JSON.stringify(basePath)] = result;
    return result;
  }

  private initSelectorStub<SelectedState>(
    selector?: Selector<State, SelectedState>,
    comparator?: Comparator,
  ): SelectorStubRecord {
    const key = selector ? selector.toString() : "";
    const record = this.selections[key] || {
      subject: new ReplaySubject<SelectedState>(),
      comparator,
    };

    this.selections[key] = record;
    return record;
  }
}

/**
 * Convenience mock to make it easier to control selector
 * behaviour in unit tests.
 */
export class MockNgRedux<T = any> extends NgRedux<T> {

  private static mockInstance?: MockNgRedux<any> = undefined;

  private mockRootStore = new MockObservableStore<any>();

  public configureSubStore = this.mockRootStore.configureSubStore as any;
  public dispatch = this.mockRootStore.dispatch as Dispatch<any>;
  public getState = this.mockRootStore.getState as any;
  public subscribe = this.mockRootStore.subscribe;
  public replaceReducer = this.mockRootStore.replaceReducer;

  public select: <SelectedType>(
    selector?: Selector<T, SelectedType>,
    comparator?: Comparator,
  ) => Observable<SelectedType> = this.mockRootStore.select;

  /** @hidden */
  constructor() {
    super();
    // This hooks the mock up to @select.
    NgRedux.instance = this as any;
  }

  /**
   * Returns a subject that's connected to any observable returned by the
   * given selector. You can use this subject to pump values into your
   * components or services under test; when they call .select or @select
   * in the context of a unit test, MockNgRedux will give them the values
   * you pushed onto your stub.
   */
  public static getSelectorStub<R, S>(
    selector?: Selector<R, S>,
    comparator?: Comparator,
  ): Subject<S> {
    return MockNgRedux.getInstance().mockRootStore.getSelectorStub<S>(
      selector,
      comparator,
    );
  }

  /**
   * Returns a mock substore that allows you to set up selectorStubs for
   * any 'fractal' stores your app creates with NgRedux.configureSubStore.
   *
   * If your app creates deeply nested substores from other substores,
   * pass the chain of pathSelectors in as ordered arguments to mock
   * the nested substores out.
   *
   * @param pathSelectors - the selectors
   */
  public static getSubStore<S>(
    ...pathSelectors: PathSelector[]
  ): MockObservableStore<S> {
    return pathSelectors.length
      ? MockNgRedux.getInstance().mockRootStore.getSubStore(...pathSelectors)
      : MockNgRedux.getInstance().mockRootStore;
  }

  /**
   * Reset all previously configured stubs.
   */
  public static reset(): void {
    MockNgRedux.getInstance().mockRootStore.reset();
    NgRedux.instance = MockNgRedux.mockInstance as any;
  }

  /**
   * Gets the singleton MockNgRedux instance. Useful for cases where your
   * tests need to spy on store methods, for example.
   */
  public static getInstance() {
    MockNgRedux.mockInstance = MockNgRedux.mockInstance || new MockNgRedux();
    return MockNgRedux.mockInstance;
  }

  public provideStore = (_: Store<any>): void => undefined;
  public configureStore = (
    _: Reducer<any, AnyAction>,
    __: any,
    ___?: Middleware[],
    ____?: StoreEnhancer<any>[],
  ): void => undefined;
}
