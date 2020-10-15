import { Injectable } from "@angular/core";

@Injectable()
export class TempStateService {
    private selected: string;
    constructor() {
        this.selected = "";
    }

    public isSelected(state: string) {
        return this.selected === state;
    }

    public toggle(state: string) {
        if (this.isSelected(state)){
            this.selected = "";
        } else {
            this.selected = state;
        }
    }
}