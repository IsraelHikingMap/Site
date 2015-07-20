module IsraelHiking.Common {
    export interface IDataChangedEventArgs {
        //applyToScope: boolean;
    }

    export class EventHelper<TData> {
        private listeners: ((data: TData) => void)[];

        constructor() {
            this.listeners = [];
        }

        addListener(delegate: (data: TData) => void) {
            this.listeners.push(delegate);
        }
        removeListener(delegate: (data: TData) => void) {
            var index = this.listeners.indexOf(delegate);
            if (index != -1) {
                this.listeners.splice(index, 1);
            }
        }
        raiseEvent(data: TData) {
            for (var listenerIndex = 0; listenerIndex < this.listeners.length; listenerIndex++) {
                this.listeners[listenerIndex](data);
            }
        }
    }

} 