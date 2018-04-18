import { Injectable } from "@angular/core"; 

@Injectable()
export class CancelableTimeoutService {
    private idsByGroup: Map<string, number[]>;

    constructor() {
        this.idsByGroup = new Map<string, number[]>();
    }

    public setTimeoutByGroup(action: Function, timeout: number, type: string) {
        if (!this.idsByGroup.has(type)) {
            this.idsByGroup.set(type, []);
        }
        let id = setTimeout(action, timeout);
        this.idsByGroup.get(type).push(id);
    }

    public clearTimeoutByGroup(type: string) {
        for (let id of this.idsByGroup.get(type) || []) {
            clearTimeout(id);
        }
    }
}