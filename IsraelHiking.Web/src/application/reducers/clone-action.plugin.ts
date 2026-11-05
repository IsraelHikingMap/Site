import type { NgxsNextPluginFn } from "@ngxs/store";

/**
 * Hands every action to the reducers as a deep copy, so the objects a caller dispatches never become part of the state.
 * @remarks Immer freezes whatever a reducer puts into a draft, which would otherwise freeze the caller's own object
 * while its type still says it is mutable, and the next write to it would throw at runtime.
 */
export function cloneActionPlugin(state: unknown, action: object, next: NgxsNextPluginFn) {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(action)), structuredClone({ ...action }));
    return next(state, clone);
}
