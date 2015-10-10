module IsraelHiking.Services.Routers {
    export class BikeRouter extends BaseRouter {

        protected getProfile(): string {
            //return "trekking";
            return "b";
        }
    }
} 