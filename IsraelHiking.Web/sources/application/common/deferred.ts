export class Deferred<T> {
    public promise: Promise<T>;
    public reject: (value?: any | PromiseLike<T>) => void;
    public resolve: (value?: any | PromiseLike<T>) => void;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
}