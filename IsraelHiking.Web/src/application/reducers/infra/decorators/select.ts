import { Comparator, Selector, Transformer } from "../components/selectors";
import { getInstanceSelection } from "./helpers";

/**
 * Selects an observable from the store, and attaches it to the decorated
 * property.
 *
 * ```ts
 *  import { select } from '@angular-redux/store';
 *
 *  class SomeClass {
 *    @select(['foo','bar']) foo$: Observable<string>
 * }
 * ```
 *
 * @param selector
 * A selector function, property name string, or property name path
 * (array of strings/array indices) that locates the store data to be
 * selected
 *
 * @param comparator Function used to determine if this selector has changed.
 */
export const select = <T>(
  selector?: Selector<any, T>,
  comparator?: Comparator,
): PropertyDecorator => (target: any, key: string | symbol): void => {
    const adjustedSelector = selector
      ? selector
      : String(key).lastIndexOf("$") === String(key).length - 1
      ? String(key).substring(0, String(key).length - 1)
      : key;
    decorate(adjustedSelector, undefined, comparator)(target, key);
  };

function decorate(
  selector: Selector<any, any>,
  transformer?: Transformer<any, any>,
  comparator?: Comparator,
): PropertyDecorator {
  return function decorator(target: any, key): void {
    function getter(this: any) {
      return getInstanceSelection(this, key, selector, transformer, comparator);
    }

    // Replace decorated property with a getter that returns the observable.
    if (delete target[key]) {
      Object.defineProperty(target, key, {
        get: getter,
        enumerable: true,
        configurable: true,
      });
    }
  };
}
