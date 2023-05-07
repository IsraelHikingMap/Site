export interface StateWithHistory<State> {
    past: State[];
    present: State;
    future: State[];
}
