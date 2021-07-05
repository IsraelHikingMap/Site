import { Action } from "redux";

type ReduxActionDescriptor = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;

export abstract class BaseAction<TPayload> implements Action {
    constructor(public type: string, public payload: TPayload) { }
}

export const classToActionMiddleware = (state: any) => (next:any) => (action:any) => next({ ...action });

export const ReduxAction = (type: string): ReduxActionDescriptor => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
            descriptor.value.type = type;
        };

export const createReducerFromClass = <State>(reducer: new () => any, initialState: State) => {
    const instance = Object.create(reducer.prototype);
    return (lastState: State = initialState, action: Action): State => {
        for (let fn in instance) {
            if (typeof instance[fn] === "function" && (instance[fn] as any).type === action.type) {
                return instance[fn].apply(instance, [lastState, action]);
            }
        }
        return lastState;

    };
};
