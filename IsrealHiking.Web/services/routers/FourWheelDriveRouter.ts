module IsraelHiking.Services.Routers {
    export class FourWheelDriveRouter extends BaseRouter {
        protected getProfile(): string {
            return "moped";
        }
    }
} 