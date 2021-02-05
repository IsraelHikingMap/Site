import { Action } from "redux";

export abstract class BaseAction<TPayload> implements Action {
    constructor(public type: string, public payload: TPayload) { }
}

export const classToActionMiddleware = (state) => (next) => (action) => next({ ...action });

export function ReduxAction(type: string):
    (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        descriptor.value.type = type;
    };
}

export function createReducerFromClass<State>(reducer: new () => any, initialState: State) {
    const instance = Object.create(reducer.prototype);
    return (lastState: State = initialState, action: Action): State => {
        for (let fn in instance) {
            if (typeof instance[fn] === "function" && (instance[fn] as any).type === action.type) {
                return instance[fn].apply(instance, [lastState, action]);
            }
        }
        return lastState;

    };
}
