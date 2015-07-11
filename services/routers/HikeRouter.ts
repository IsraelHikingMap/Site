module IsraelHiking.Services.Routers {
    export class HikeRouter extends BaseRouter {
        protected getProfile(): string {
            return "trekking";
        }
    }
}