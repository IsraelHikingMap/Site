import { Injectable } from "@angular/core";

@Injectable()
export class CancelableTimeoutService {
    private idsByGroup: Map<string, number[]>;

    constructor() {
        this.idsByGroup = new Map<string, number[]>();
    }

    public setTimeoutByGroup(action: () => void, timeout: number, type: string) {
        if (!this.idsByGroup.has(type)) {
            this.idsByGroup.set(type, []);
        }
        const id = setTimeout(action, timeout);
        this.idsByGroup.get(type).push(id as any);
    }

    public clearTimeoutByGroup(type: string) {
        for (const id of this.idsByGroup.get(type) || []) {
            clearTimeout(id);
        }
    }
}
