module IsraelHiking.Services {

    export class SidebarService {
        public viewName: string;
        public isVisible: boolean;

        constructor() {
            this.hide();
        }

        public toggle = (viewName: string) => {
            if (this.viewName === viewName) {
                this.hide();
                return;
            }
            this.isVisible = true;
            this.viewName = viewName;
        }

        public hide = () => {
            this.isVisible = false;
            this.viewName = "";
        }
    }
}