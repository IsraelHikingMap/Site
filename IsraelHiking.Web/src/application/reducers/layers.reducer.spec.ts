import { describe, beforeEach, it, expect } from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideStore, Store } from "@ngxs/store";

import {
    LayersReducer,
    AddBaseLayerAction,
    AddOverlayAction,
    RemoveBaseLayerAction,
    RemoveOverlayAction,
    SetLayerShownInPanelAction,
    UpdateBaseLayerAction,
    UpdateOverlayAction
} from "./layers.reducer";
import type { ApplicationState, EditableLayer } from "../models";

describe("LayersReducer - layers hidden from the panel", () => {
    let store: Store;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideStore([LayersReducer])]
        });
        store = TestBed.inject(Store);
    });

    it("Should hide a layer from the panel and show it again", () => {
        store.dispatch(new SetLayerShownInPanelAction("MTB Map", false, false));
        expect(hiddenKeys()).toEqual(["MTB Map"]);

        store.dispatch(new SetLayerShownInPanelAction("MTB Map", false, true));
        expect(hiddenKeys()).toEqual([]);
    });

    it("Should not add the same layer twice", () => {
        store.dispatch(new SetLayerShownInPanelAction("MTB Map", false, false));
        store.dispatch(new SetLayerShownInPanelAction("MTB Map", false, false));

        expect(hiddenKeys()).toEqual(["MTB Map"]);
    });

    it("Should keep a renamed base layer hidden", () => {
        store.dispatch(new AddBaseLayerAction(createLayer("old")));
        store.dispatch(new SetLayerShownInPanelAction("old", false, false));

        store.dispatch(new UpdateBaseLayerAction("old", createLayer("new")));

        expect(hiddenKeys()).toEqual(["new"]);
    });

    it("Should keep a renamed overlay hidden", () => {
        store.dispatch(new AddOverlayAction(createLayer("old")));
        store.dispatch(new SetLayerShownInPanelAction("old", true, false));

        store.dispatch(new UpdateOverlayAction("old", createLayer("new")));

        expect(hiddenOverlayKeys()).toEqual(["new"]);
    });

    it("Should forget a removed base layer, so one added later with its name is listed", () => {
        store.dispatch(new AddBaseLayerAction(createLayer("custom")));
        store.dispatch(new SetLayerShownInPanelAction("custom", false, false));

        store.dispatch(new RemoveBaseLayerAction("custom"));

        expect(hiddenKeys()).toEqual([]);
    });

    it("Should forget a removed overlay", () => {
        store.dispatch(new AddOverlayAction(createLayer("custom")));
        store.dispatch(new SetLayerShownInPanelAction("custom", true, false));

        store.dispatch(new RemoveOverlayAction("custom"));

        expect(hiddenOverlayKeys()).toEqual([]);
    });

    it("Should hide an overlay without hiding a base layer that has the same name", () => {
        store.dispatch(new AddBaseLayerAction(createLayer("shared")));
        store.dispatch(new AddOverlayAction(createLayer("shared")));

        store.dispatch(new SetLayerShownInPanelAction("shared", true, false));

        expect(hiddenOverlayKeys()).toEqual(["shared"]);
        expect(hiddenKeys()).toEqual([]);
    });

    function hiddenKeys(): readonly string[] {
        return store.selectSnapshot((s: ApplicationState) => s.layersState.hiddenBaseLayers);
    }

    function hiddenOverlayKeys(): readonly string[] {
        return store.selectSnapshot((s: ApplicationState) => s.layersState.hiddenOverlays);
    }
});

function createLayer(key: string): EditableLayer {
    return { key, address: "https://example.com/{z}/{x}/{y}.png", minZoom: 1, maxZoom: 16, opacity: 1, isEditable: true, id: key };
}
