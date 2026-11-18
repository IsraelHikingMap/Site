import type { Draft } from "immer";

/**
 * Returns a deep copy of a value read from the store that can be changed freely.
 * @remarks Everything in the store is frozen, so a value read from it has to be copied before it is changed,
 * and this is the one place that copy is made.
 */
export function editableCopy<T>(value: T): Draft<T> {
    return structuredClone(value) as Draft<T>;
}
