import { CancelableTimeoutService } from "./cancelable-timeout.service"

describe("CancelableTimeoutService", () => {
    let service: CancelableTimeoutService;

    beforeEach(() => {
        service = new CancelableTimeoutService();
    })
    it("should set timeout by name", async () => {
        let resolve;
        const promise = new Promise((res) => resolve = res);
        service.setTimeoutByName(resolve, 0, "test");

        await expectAsync(promise).toBeResolved();
    });

    it("should fire timeout only once", async () => {
        let counter = 0;
        let resolve: () => void;
        const promise = new Promise<void>((res) => {resolve = res});
        service.setTimeoutByName(() => { 
            counter++;
            resolve(); 
        }, 10, "test");

        service.setTimeoutByName(() => { 
            counter++;
            resolve(); 
        }, 10, "test");

        await expectAsync(promise).toBeResolved();
        expect(counter).toBe(1);
    });

    it("should not fire timeout when cancelled", async () => {
        let counter = 0;
        service.setTimeoutByName(() => { 
            counter++;
        }, 10, "test");

        service.clearTimeoutByName("test");

        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(counter).toBe(0);
    });
})