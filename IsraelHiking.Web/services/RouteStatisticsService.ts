namespace IsraelHiking.Services {
    export class RouteStatisticsService {
        public isVisible: boolean;

        constructor() {
            this.hide();
        }

        public toggle = () => {
            if (this.isVisible) {
                this.hide();
                return;
            }
            this.isVisible = true;
        }

        public hide = () => {
            this.isVisible = false;
        }
    }
}