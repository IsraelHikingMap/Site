import Compression
import Foundation
import PMTiles

/**
 * Reads offline vector tiles from the PMTiles archives the app downloads into its Documents
 * directory (Capacitor `Directory.Data`). Mirrors `PmTilesService.kt`: same sub-pyramid file
 * naming (`{type}+7-{x}-{y}.pmtiles` for z>=7, `{type}-6.pmtiles` below) and the same
 * none/gzip tile decompression.
 *
 * `sfomuseum/swift-pmtiles` (`PMTilesReader`) is used only for byte-range file I/O; the PMTiles v3
 * header / directory parsing and Hilbert tile addressing are implemented here because the package
 * does not expose tile lookup.
 */
final class PMTilesService {

    static let tilesZoom = 7

    private let baseDir: URL
    private let lock = NSLock()
    private var archives: [String: Archive] = [:]

    init() {
        baseDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
    }

    func isOfflineFileAvailable(z: Int, x: Int, y: Int, type: String) -> Bool {
        let url = baseDir.appendingPathComponent(fileName(z: z, x: x, y: y, type: type))
        return FileManager.default.fileExists(atPath: url.path)
    }

    /// Returns the decompressed tile bytes, or nil when the archive has no such tile.
    func getTileByType(z: Int, x: Int, y: Int, type: String) -> Data? {
        let name = fileName(z: z, x: x, y: y, type: type)
        guard let archive = archive(for: name) else { return nil }
        guard let raw = archive.tile(z: z, x: x, y: y) else { return nil }
        return decompress(raw, compression: archive.header.tileCompression)
    }

    private func fileName(z: Int, x: Int, y: Int, type: String) -> String {
        if z >= Self.tilesZoom {
            let scale = 1 << (z - Self.tilesZoom)
            return "\(type)+\(Self.tilesZoom)-\(x / scale)-\(y / scale).pmtiles"
        }
        return "\(type)-\(Self.tilesZoom - 1).pmtiles"
    }

    private func archive(for name: String) -> Archive? {
        lock.lock(); defer { lock.unlock() }
        if let cached = archives[name] { return cached }
        let url = baseDir.appendingPathComponent(name)
        guard FileManager.default.fileExists(atPath: url.path),
              let archive = try? Archive(url: url)
        else { return nil }
        archives[name] = archive
        return archive
    }
}

// MARK: - PMTiles v3 archive

private final class Archive {

    struct Header {
        let rootDirOffset: UInt64
        let rootDirLength: UInt64
        let leafDirsOffset: UInt64
        let tileDataOffset: UInt64
        let internalCompression: UInt8
        let tileCompression: UInt8
    }

    struct Entry {
        let tileId: UInt64
        let offset: UInt64
        let length: UInt32
        let runLength: UInt32
    }

    let header: Header
    private let reader: PMTilesReader
    private let lock = NSLock()
    private lazy var rootEntries: [Entry] = loadDirectory(offset: header.rootDirOffset, length: header.rootDirLength)

    init(url: URL) throws {
        reader = try PMTilesReader(PMTilesReaderOptions(url))
        let headerData = try Archive.read(reader, offset: 0, length: 127)
        guard headerData.count >= 127,
              headerData[0] == 0x50, headerData[1] == 0x4D, headerData[2] == 0x54 // "PMT"
        else { throw PMTilesError.badHeader }
        header = Header(
            rootDirOffset: headerData.u64(8),
            rootDirLength: headerData.u64(16),
            leafDirsOffset: headerData.u64(40),
            tileDataOffset: headerData.u64(56),
            internalCompression: headerData[97],
            tileCompression: headerData[98]
        )
    }

    func tile(z: Int, x: Int, y: Int) -> Data? {
        let tileId = Archive.zxyToTileId(z: z, x: x, y: y)
        lock.lock(); defer { lock.unlock() }
        var entries = rootEntries
        // PMTiles allows one level of leaf directories; loop guards against malformed archives.
        for _ in 0..<4 {
            guard let entry = Archive.find(entries, tileId: tileId) else { return nil }
            if entry.runLength == 0 {
                entries = loadDirectory(offset: header.leafDirsOffset + entry.offset,
                                        length: UInt64(entry.length))
                continue
            }
            guard tileId - entry.tileId < UInt64(entry.runLength) else { return nil }
            return try? Archive.read(reader,
                                     offset: header.tileDataOffset + entry.offset,
                                     length: Int(entry.length))
        }
        return nil
    }

    // MARK: directory loading

    private func loadDirectory(offset: UInt64, length: UInt64) -> [Entry] {
        guard length > 0,
              let raw = try? Archive.read(reader, offset: offset, length: Int(length)),
              let bytes = decompressInternal(raw)
        else { return [] }
        return Archive.deserialize(bytes)
    }

    private func decompressInternal(_ data: Data) -> Data? {
        switch header.internalCompression {
        case 1: return data
        case 2: return Gzip.decompress(data)
        default: return nil
        }
    }

    private static func deserialize(_ data: Data) -> [Entry] {
        var cursor = 0
        let bytes = [UInt8](data)
        func varint() -> UInt64 {
            var result: UInt64 = 0
            var shift: UInt64 = 0
            while cursor < bytes.count {
                let b = bytes[cursor]; cursor += 1
                result |= UInt64(b & 0x7F) << shift
                if b & 0x80 == 0 { break }
                shift += 7
            }
            return result
        }

        let count = Int(varint())
        guard count > 0, count < 10_000_000 else { return [] }
        var tileIds = [UInt64](repeating: 0, count: count)
        var runLengths = [UInt32](repeating: 0, count: count)
        var lengths = [UInt32](repeating: 0, count: count)
        var offsets = [UInt64](repeating: 0, count: count)

        var lastId: UInt64 = 0
        for i in 0..<count { lastId += varint(); tileIds[i] = lastId }
        for i in 0..<count { runLengths[i] = UInt32(truncatingIfNeeded: varint()) }
        for i in 0..<count { lengths[i] = UInt32(truncatingIfNeeded: varint()) }
        for i in 0..<count {
            let v = varint()
            if v == 0 && i > 0 {
                offsets[i] = offsets[i - 1] + UInt64(lengths[i - 1])
            } else {
                offsets[i] = v - 1
            }
        }
        return (0..<count).map {
            Entry(tileId: tileIds[$0], offset: offsets[$0], length: lengths[$0], runLength: runLengths[$0])
        }
    }

    /// Binary search for the entry covering `tileId` (largest entry whose tileId <= target).
    private static func find(_ entries: [Entry], tileId: UInt64) -> Entry? {
        var m = 0
        var n = entries.count - 1
        while m <= n {
            let k = (n + m) >> 1
            if tileId > entries[k].tileId {
                m = k + 1
            } else if tileId < entries[k].tileId {
                n = k - 1
            } else {
                return entries[k]
            }
        }
        if n >= 0 {
            if entries[n].runLength == 0 { return entries[n] }
            if tileId - entries[n].tileId < UInt64(entries[n].runLength) { return entries[n] }
        }
        return nil
    }

    // Standard Hilbert-curve tile id used by the PMTiles spec.
    private static func zxyToTileId(z: Int, x: Int, y: Int) -> UInt64 {
        var acc: UInt64 = 0
        for t in 0..<z { acc += (UInt64(1) << t) * (UInt64(1) << t) }
        let n = UInt64(1) << z
        var d: UInt64 = 0
        var xx = UInt64(x)
        var yy = UInt64(y)
        var s = n >> 1
        while s > 0 {
            let rx: UInt64 = (xx & s) > 0 ? 1 : 0
            let ry: UInt64 = (yy & s) > 0 ? 1 : 0
            d += s * s * ((3 * rx) ^ ry)
            if ry == 0 {
                if rx == 1 {
                    xx = n - 1 - xx
                    yy = n - 1 - yy
                }
                let t = xx; xx = yy; yy = t
            }
            s >>= 1
        }
        return acc + d
    }

    private static func read(_ reader: PMTilesReader, offset: UInt64, length: Int) throws -> Data {
        guard length > 0 else { return Data() }
        // PMTilesReader.Read(from:to:) reads bytes from `from` through `to` inclusive.
        switch reader.Read(from: offset, to: offset + UInt64(length) - 1) {
        case .success(let data): return data
        case .failure(let error): throw error
        }
    }
}

private enum PMTilesError: Error { case badHeader }

// MARK: - gzip + byte helpers

func decompress(_ data: Data, compression: UInt8) -> Data? {
    switch compression {
    case 1: return data
    case 2: return Gzip.decompress(data)
    default: return nil
    }
}

private enum Gzip {
    /// Strips the gzip (RFC 1952) wrapper and inflates the raw DEFLATE body via libcompression.
    static func decompress(_ data: Data) -> Data? {
        let bytes = [UInt8](data)
        guard bytes.count > 18, bytes[0] == 0x1F, bytes[1] == 0x8B, bytes[2] == 8 else { return nil }
        let flags = bytes[3]
        var idx = 10
        if flags & 0x04 != 0 { // FEXTRA
            guard idx + 2 <= bytes.count else { return nil }
            let xlen = Int(bytes[idx]) | (Int(bytes[idx + 1]) << 8)
            idx += 2 + xlen
        }
        if flags & 0x08 != 0 { while idx < bytes.count && bytes[idx] != 0 { idx += 1 }; idx += 1 } // FNAME
        if flags & 0x10 != 0 { while idx < bytes.count && bytes[idx] != 0 { idx += 1 }; idx += 1 } // FCOMMENT
        if flags & 0x02 != 0 { idx += 2 } // FHCRC
        guard idx < bytes.count - 8 else { return nil }

        let isize = UInt32(bytes[bytes.count - 4])
            | (UInt32(bytes[bytes.count - 3]) << 8)
            | (UInt32(bytes[bytes.count - 2]) << 16)
            | (UInt32(bytes[bytes.count - 1]) << 24)
        var capacity = Int(isize)
        if capacity <= 0 { capacity = (bytes.count - idx - 8) * 8 + 1024 }

        let deflate = data.subdata(in: idx..<(data.count - 8))
        let dst = UnsafeMutablePointer<UInt8>.allocate(capacity: capacity)
        defer { dst.deallocate() }
        let written = deflate.withUnsafeBytes { (src: UnsafeRawBufferPointer) -> Int in
            guard let base = src.bindMemory(to: UInt8.self).baseAddress else { return 0 }
            return compression_decode_buffer(dst, capacity, base, deflate.count, nil, COMPRESSION_ZLIB)
        }
        guard written > 0 else { return nil }
        return Data(bytes: dst, count: written)
    }
}

private extension Data {
    /// Little-endian UInt64 at byte offset.
    func u64(_ offset: Int) -> UInt64 {
        var value: UInt64 = 0
        for i in 0..<8 { value |= UInt64(self[self.startIndex + offset + i]) << (8 * i) }
        return value
    }
}
