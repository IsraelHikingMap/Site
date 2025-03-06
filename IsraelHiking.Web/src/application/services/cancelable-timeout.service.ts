import { Injectable } from "@angular/core";

@Injectable()
export class CancelableTimeoutService {
    private idForName = new Map<string, ReturnType<typeof setTimeout>>;

    public setTimeoutByName(callback: Parameters<typeof setTimeout>[0], timeout: Parameters<typeof setTimeout>[1], name: string) {
        this.clearTimeoutByName(name);
        const id = setTimeout(callback, timeout);
        this.idForName.set(name, id);
    }

    public clearTimeoutByName(name: string) {
        if (this.idForName.has(name)) {
            clearTimeout(this.idForName.get(name));
        }
    }
}
