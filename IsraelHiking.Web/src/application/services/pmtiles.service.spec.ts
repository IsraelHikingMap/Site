import { inject, TestBed } from "@angular/core/testing";
import { Filesystem } from "@capacitor/filesystem";
import { encode } from "base64-arraybuffer";
import { PmTilesService } from "./pmtiles.service";

describe("PmTilesService", () => {
    beforeEach(async () => {
        const base64 = "UE1UaWxlcwN/AAAAAAAAABkAAAAAAAAAmAAAAAAAAAD3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAACPAQAAAAAAAEUAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAAICAQAAAAAAAAAAAAB/lpgAgJaYAAAAAAAAAAAAAB+LCAAAAAAAAhNjZGB0ZQQATD+JAAUAAAAfiwgAAAAAAAITfU/LboMwELznK6w9AyWReum1P9B7hZBjFmQJe5G9RCHI/x7bSRv6UI4zOzuPdQdWGoQ3AYye216feXbY7qvJsB7RQ7GDDr1yemJN9rnwhM7fRYeEeZmyNcXDKJdEDWjRSSaXnfQ0oZKWUJwO1WtV/1C0lCN9UlYvG215GURJ4v8eoix7cgpvfVTyidGxWLT5FKsA3f0d8b1B/B6bKKPthchEWCckzxvUaxy75L0GEURTQDZiyZmDHP1Os+UI9wU8qtxvT7qAevwNSAbZLUn+QeMyxHYFSGanjzPjV0K94XJKE5oQrptsCtvlAQAAH4sIAAAAAAACE5PSr2DiEi1JLS6JT8usKCktSo03LMgtycxJLdZoUBASlGBW4uWcpvBCXopBQpSBQZwfAJf6ay0xAAAAAAAB";

        // Mock Capacitor Filesystem
        spyOn(Filesystem, "readFile").and.callFake(async () => {
            const pmTilesBlob = await fetch(`data:application/octet-stream;base64,${base64}`).then(res => res.arrayBuffer());
            return { data: encode(pmTilesBlob) };
        });

        TestBed.configureTestingModule({
            imports: [],
            providers: [
                PmTilesService
            ]
        });
    });

    it("Should get a tile", inject([PmTilesService], async (service: PmTilesService) => {
        const results = await service.getTile("custom://filename-without-pmtiles-extention/0/0/0.png");
        expect(results).toBeDefined();
    }));

    it("Should use the cache when getting a tile", inject([PmTilesService], async (service: PmTilesService) => {
        let results = await service.getTile("custom://filename-without-pmtiles-extention/0/0/0.png");
        results = await service.getTile("custom://filename-without-pmtiles-extention/0/0/0.png");
        expect(results).toBeDefined();
    }));
});
