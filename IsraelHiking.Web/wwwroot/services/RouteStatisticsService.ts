namespace IsraelHiking.Services {
    export class RouteStatisticsService {
        public isVisible: boolean;

        constructor() {
            this.isVisible = false;
        }

        public toggle = () => {
            if (this.isVisible) {
                this.isVisible = false;
                return;
            }
            this.isVisible = true;
        }
    }
}